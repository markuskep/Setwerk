package at.setwerk.app;
import android.app.*;
import android.os.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.webkit.*;
import android.view.View;
import org.json.JSONObject;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

public class MainActivity extends Activity {
  private HealthStepsClient health;
  private HealthStepsClient.Reply stepPermissionReply;
  private WebView web; private SharedPreferences prefs; private CloudClient cloud;
  private final ScheduledExecutorService restSounds=Executors.newSingleThreadScheduledExecutor();
  private final List<ScheduledFuture<?>> restSoundJobs=new ArrayList<>();
  private synchronized void clearRestSounds(){for(ScheduledFuture<?> job:restSoundJobs)job.cancel(false);restSoundJobs.clear();}
  private void restTone(boolean high){try{int rate=24000,count=rate/5;short[] samples=new short[count];for(int i=0;i<count;i++){double envelope=Math.min(1.0,i/(rate*.01))*Math.min(1.0,(count-i)/(rate*.03));samples[i]=(short)(Math.sin(2*Math.PI*(high?1100:700)*i/rate)*(high?16000:9000)*envelope);}android.media.AudioTrack track=new android.media.AudioTrack.Builder().setAudioAttributes(new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_MEDIA).setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION).build()).setAudioFormat(new android.media.AudioFormat.Builder().setSampleRate(rate).setEncoding(android.media.AudioFormat.ENCODING_PCM_16BIT).setChannelMask(android.media.AudioFormat.CHANNEL_OUT_MONO).build()).setBufferSizeInBytes(count*2).setTransferMode(android.media.AudioTrack.MODE_STATIC).build();track.write(samples,0,count);track.play();restSounds.schedule(track::release,300,TimeUnit.MILLISECONDS);}catch(Exception ignored){}}

  private synchronized void queueRestSounds(long until){clearRestSounds();for(int n=3;n>=0;n--){long delay=until-System.currentTimeMillis()-n*1000;boolean high=n==0;if(delay>0)restSoundJobs.add(restSounds.schedule(()->restTone(high),delay,TimeUnit.MILLISECONDS));}}
  private final ExecutorService network=Executors.newSingleThreadExecutor();
  private ValueCallback<Uri[]> fileCallback; private byte[] exportBytes;
  private static final String ORIGIN="https://appassets.androidplatform.net";
  @Override public void onCreate(Bundle saved){
    super.onCreate(saved);if(Build.VERSION.SDK_INT>=34)health=new HealthStepsClient(this,network);prefs=getSharedPreferences("setwerk",MODE_PRIVATE);cloud=new CloudClient(this);ReminderReceiver.createChannel(this);
    web=new WebView(this);web.setBackgroundColor(Color.rgb(242,244,240));web.setFitsSystemWindows(true);
    web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(true);web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);web.getSettings().setMediaPlaybackRequiresUserGesture(true);
    web.setWebViewClient(new WebViewClient(){
      @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
        Uri uri=request.getUrl();String file=uri.getLastPathSegment();
        if("GET".equals(request.getMethod())&&ORIGIN.equals(uri.getScheme()+"://"+uri.getAuthority())&&file!=null&&uri.getPath().equals("/assets/"+file)&&file.matches("[a-zA-Z0-9_.-]+")){
          try{String mime=file.endsWith(".js")?"text/javascript":file.endsWith(".css")?"text/css":file.endsWith(".png")?"image/png":file.endsWith(".html")?"text/html":file.endsWith(".svg")?"image/svg+xml":"application/json";
            return new WebResourceResponse(mime,"UTF-8",getAssets().open(file));}catch(IOException ignored){}
        }
        return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
      }
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return true;}
    });
    web.setWebChromeClient(new WebChromeClient(){
      @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
        if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=callback;
        String accepted=String.join(",",params.getAcceptTypes());
        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(accepted.contains("image/")?"image/*":"*/*");
        startActivityForResult(intent,80);return true;
      }
    });
    web.addJavascriptInterface(new Bridge(),"AndroidGym");setContentView(web);
    web.loadUrl(ORIGIN+"/assets/index.html");ReminderReceiver.scheduleAll(this);
  }
  private void deliver(String id,FirebaseClient.Result result){
    runOnUiThread(()->{if(web!=null)web.evaluateJavascript("window.SetwerkNative?.receive("+JSONObject.quote(id)+","+result.status+","+JSONObject.quote(result.body)+")",null);});
  }
  private FirebaseClient.Result legacy(String operation,String raw){
    final String prefix="cloud-data.https://setwerk.netlify.app|setwerk.account.v1.";
    try{
      if(operation.equals("legacy-read")){
        String id=new JSONObject(raw).getString("id");if(!id.matches("[A-Za-z0-9_-]{1,100}"))throw new IllegalArgumentException();
        JSONObject state=new JSONObject(prefs.getString(prefix+id,"{}")).getJSONObject("state");
        return new FirebaseClient.Result(200,new JSONObject().put("state",state).toString());
      }
      if(operation.equals("legacy-list")){
        org.json.JSONArray accounts=new org.json.JSONArray();
        JSONObject remembered=new JSONObject(prefs.getString("cloud-data.https://setwerk.netlify.app|setwerk.last-account.v1","{}"));
        for(String key:prefs.getAll().keySet()){
          if(!key.startsWith(prefix))continue;String id=key.substring(prefix.length());if(!id.matches("[A-Za-z0-9_-]{1,100}"))continue;
          try{
            JSONObject state=new JSONObject(prefs.getString(key,"{}")).getJSONObject("state");
            int sessions=state.getJSONArray("sessions").length(),templates=state.getJSONArray("templates").length();
            if(sessions==0&&templates==0&&state.isNull("active")&&state.isNull("draft"))continue;
            accounts.put(new JSONObject().put("id",id).put("email",id.equals(remembered.optString("id"))?remembered.optString("email"):"").put("sessions",sessions).put("templates",templates));
          }catch(Exception ignored){}
        }
        return new FirebaseClient.Result(200,new JSONObject().put("accounts",accounts).toString());
      }
    }catch(Exception ignored){}
    return new FirebaseClient.Result(422,"{\"code\":\"setwerk/invalid-backup\"}");
  }
  public final class Bridge {
    @JavascriptInterface public String readState(){return prefs.getString("state","");}
    @JavascriptInterface public boolean writeState(String raw){try{if(new JSONObject(raw).getInt("version")!=1)return false;return prefs.edit().putString("state",raw).commit();}catch(Exception e){return false;}}
    private String storageKey(String key){if(key.equals("setwerk.v1"))return "state";if(!key.startsWith("setwerk."))throw new IllegalArgumentException();return "cloud-data."+cloud.site()+"|"+key;}
    @JavascriptInterface public String storageGet(String key){return prefs.getString(storageKey(key),null);}
    @JavascriptInterface public boolean storageSet(String key,String raw){if(raw.length()>3*1024*1024)return false;return prefs.edit().putString(storageKey(key),raw).commit();}
    @JavascriptInterface public boolean storageRemove(String key){return prefs.edit().remove(storageKey(key)).commit();}
    @JavascriptInterface public String getSite(){return cloud.site();}
    @JavascriptInterface public void request(String id,String operation,String body){
      if(!id.matches("[0-9]{1,12}")||body.length()>2*1024*1024)return;
      if(operation.startsWith("steps-")){
        runOnUiThread(()->{
          HealthStepsClient.Reply reply=(status,raw)->deliver(id,new FirebaseClient.Result(status,raw));
          try{
            JSONObject input=new JSONObject(body);
            if(operation.equals("steps-status"))reply.send(200,StepCounterService.status(MainActivity.this).toString());
            else if(operation.equals("steps-connect")){
              if(!StepCounterService.supported(MainActivity.this)){reply.send(503,"{\"code\":\"steps/unavailable\"}");return;}
              if(StepCounterService.granted(MainActivity.this)){reply.send(200,StepCounterService.status(MainActivity.this).toString());return;}
              if(stepPermissionReply!=null){reply.send(409,"{\"code\":\"steps/busy\"}");return;}
              stepPermissionReply=reply;requestPermissions(new String[]{StepCounterService.PERMISSION},84);
            }else if(operation.equals("steps-start")){
              StepCounterService.start(MainActivity.this,input.getString("owner"),input.getLong("base"));reply.send(200,"{}");
            }else if(operation.equals("steps-read"))reply.send(200,StepCounterService.read(MainActivity.this,input.getString("owner")).toString());
            else if(operation.equals("steps-stop")){StepCounterService.stop(MainActivity.this);reply.send(200,"{}");}
            else reply.send(400,"{\"code\":\"steps/invalid-operation\"}");
          }catch(SecurityException e){reply.send(403,"{\"code\":\"steps/permission-denied\"}");}
          catch(Exception e){reply.send(503,"{\"code\":\"steps/unavailable\"}");}
        });return;
      }
      if(operation.startsWith("health-")){
        runOnUiThread(()->{
          if(health==null){deliver(id,new FirebaseClient.Result(200,"{\"supported\":false,\"granted\":false}"));return;}
          HealthStepsClient.Reply reply=(status,raw)->deliver(id,new FirebaseClient.Result(status,raw));
          if(operation.equals("health-status"))health.status(reply);
          else if(operation.equals("health-connect"))health.connect(reply);
          else if(operation.equals("health-read"))health.read(reply);
          else if(operation.equals("health-settings"))health.settings(reply);
          else deliver(id,new FirebaseClient.Result(400,"{\"code\":\"health/invalid-operation\"}"));
        });return;
      }
      network.execute(()->deliver(id,operation.startsWith("legacy-")?legacy(operation,body):cloud.call(operation,body)));
    }
    @JavascriptInterface public void playRestStart(){restTone(false);}
    @JavascriptInterface public void scheduleRest(double until){queueRestSounds((long)until);ReminderReceiver.scheduleRest(MainActivity.this,(long)until);}
    @JavascriptInterface public void cancelRest(){clearRestSounds();ReminderReceiver.cancelRest(MainActivity.this);}
    @JavascriptInterface public void accountSettings(String raw){try{JSONObject state=new JSONObject(raw);String goals=state.getJSONObject("goals").toString();boolean changed=!goals.equals(prefs.getString("goals",""));prefs.edit().putString("display-language",state.optString("language","de")).putString("goals",goals).commit();cloud.language(state.optString("language","de"));if(changed)ReminderReceiver.scheduleAll(MainActivity.this);}catch(Exception ignored){}}
    @JavascriptInterface public void setReminders(String raw){try{JSONObject goals=new JSONObject(raw);prefs.edit().putString("goals",raw).commit();ReminderReceiver.scheduleAll(MainActivity.this);if(goals.optBoolean("reminders"))runOnUiThread(()->requestNotifications());}catch(Exception ignored){}}
    @JavascriptInterface public void saveFile(String name,String data){
      if(data.length()>4*1024*1024)return;
      byte[] bytes;try{bytes=android.util.Base64.decode(data,android.util.Base64.DEFAULT);}catch(Exception e){return;}
      runOnUiThread(()->{if(exportBytes!=null)return;exportBytes=bytes;Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE,name.replaceAll("[^A-Za-z0-9_.-]","_"));startActivityForResult(intent,81);});
    }
  }
  private void requestNotifications(){if(Build.VERSION.SDK_INT>=33&&checkSelfPermission("android.permission.POST_NOTIFICATIONS")!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"},7);}
  @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] grants){
    super.onRequestPermissionsResult(request,permissions,grants);if(request==83&&health!=null)health.permissionResult();
    if(request==84&&stepPermissionReply!=null){HealthStepsClient.Reply reply=stepPermissionReply;stepPermissionReply=null;try{reply.send(200,StepCounterService.status(this).toString());}catch(Exception e){reply.send(503,"{\"code\":\"steps/unavailable\"}");}}
  }
  @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);
    if(request==80&&fileCallback!=null){fileCallback.onReceiveValue(result==RESULT_OK&&data!=null?new Uri[]{data.getData()}:null);fileCallback=null;}
    if(request==81){byte[] bytes=exportBytes;exportBytes=null;if(result==RESULT_OK&&data!=null&&bytes!=null)try(OutputStream out=getContentResolver().openOutputStream(data.getData())){out.write(bytes);}catch(Exception e){web.evaluateJavascript("toast('Datei konnte nicht gespeichert werden.')",null);}}
  }
  @Override protected void onResume(){super.onResume();if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('setwerk:resume'))",null);}
  @Override public void onBackPressed(){web.evaluateJavascript("(()=>{if(!document.querySelector('#auth-gate').hidden){document.querySelector('[data-auth-close]').click();return;}for(const d of document.querySelectorAll('dialog[open]')){d.dispatchEvent(new Event('cancel',{cancelable:true}));d.close();return;}if(state.active){earlyEnd();return;}navigate('home');})()",null);}
  @Override protected void onDestroy(){clearRestSounds();restSounds.shutdownNow();network.shutdownNow();if(fileCallback!=null)fileCallback.onReceiveValue(null);if(web!=null){web.removeJavascriptInterface("AndroidGym");web.destroy();web=null;}super.onDestroy();}
}
