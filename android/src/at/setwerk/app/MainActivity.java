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
  private WebView web; private SharedPreferences prefs; private CloudClient cloud;
  private final ExecutorService network=Executors.newSingleThreadExecutor();
  private ValueCallback<Uri[]> fileCallback; private byte[] exportBytes;
  private static final String ORIGIN="https://appassets.androidplatform.net";
  @Override public void onCreate(Bundle saved){
    super.onCreate(saved);prefs=getSharedPreferences("setwerk",MODE_PRIVATE);cloud=new CloudClient(this);ReminderReceiver.createChannel(this);
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
      network.execute(()->deliver(id,operation.startsWith("legacy-")?legacy(operation,body):cloud.call(operation,body)));
    }
    @JavascriptInterface public void scheduleRest(double until){ReminderReceiver.scheduleRest(MainActivity.this,(long)until);}
    @JavascriptInterface public void cancelRest(){ReminderReceiver.cancelRest(MainActivity.this);}
    @JavascriptInterface public void accountSettings(String raw){try{JSONObject state=new JSONObject(raw);String goals=state.getJSONObject("goals").toString();boolean changed=!goals.equals(prefs.getString("goals",""));prefs.edit().putString("display-language",state.optString("language","de")).putString("goals",goals).commit();cloud.language(state.optString("language","de"));if(changed)ReminderReceiver.scheduleAll(MainActivity.this);}catch(Exception ignored){}}
    @JavascriptInterface public void setReminders(String raw){try{JSONObject goals=new JSONObject(raw);prefs.edit().putString("goals",raw).commit();ReminderReceiver.scheduleAll(MainActivity.this);if(goals.optBoolean("reminders"))runOnUiThread(()->requestNotifications());}catch(Exception ignored){}}
    @JavascriptInterface public void saveFile(String name,String data){
      if(data.length()>4*1024*1024)return;
      byte[] bytes;try{bytes=android.util.Base64.decode(data,android.util.Base64.DEFAULT);}catch(Exception e){return;}
      runOnUiThread(()->{if(exportBytes!=null)return;exportBytes=bytes;Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE,name.replaceAll("[^A-Za-z0-9_.-]","_"));startActivityForResult(intent,81);});
    }
  }
  private void requestNotifications(){if(Build.VERSION.SDK_INT>=33&&checkSelfPermission("android.permission.POST_NOTIFICATIONS")!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"},7);}
  @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);
    if(request==80&&fileCallback!=null){fileCallback.onReceiveValue(result==RESULT_OK&&data!=null?new Uri[]{data.getData()}:null);fileCallback=null;}
    if(request==81){byte[] bytes=exportBytes;exportBytes=null;if(result==RESULT_OK&&data!=null&&bytes!=null)try(OutputStream out=getContentResolver().openOutputStream(data.getData())){out.write(bytes);}catch(Exception e){web.evaluateJavascript("toast('Datei konnte nicht gespeichert werden.')",null);}}
  }
  @Override protected void onResume(){super.onResume();if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('setwerk:resume'))",null);}
  @Override public void onBackPressed(){web.evaluateJavascript("(()=>{if(!document.querySelector('#auth-gate').hidden){document.querySelector('[data-auth-close]').click();return;}for(const d of document.querySelectorAll('dialog[open]')){d.dispatchEvent(new Event('cancel',{cancelable:true}));d.close();return;}if(state.active){earlyEnd();return;}navigate('home');})()",null);}
  @Override protected void onDestroy(){network.shutdownNow();if(fileCallback!=null)fileCallback.onReceiveValue(null);if(web!=null){web.removeJavascriptInterface("AndroidGym");web.destroy();web=null;}super.onDestroy();}
}
