package at.setwerk.app;

import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.hardware.*;
import android.os.*;
import android.provider.Settings;
import org.json.JSONObject;
import java.time.*;
import java.util.Iterator;

/** Low-power hardware counter; no network access and no Health Connect writes. */
public final class StepCounterService extends Service implements SensorEventListener {
  static final String PERMISSION="android.permission.ACTIVITY_RECOGNITION";
  private static final String CHANNEL="setwerk_steps";
  private static final int NOTIFICATION=420;
  private static StepCounterService running;
  private SensorManager sensors;
  private SharedPreferences prefs;
  private String owner="";
  private static SharedPreferences store(Context c){return c.getSharedPreferences("setwerk-steps",0);}
  static boolean granted(Context c){return Build.VERSION.SDK_INT<29 || c.checkSelfPermission(PERMISSION)==PackageManager.PERMISSION_GRANTED;}
  static boolean supported(Context c){SensorManager sm=c.getSystemService(SensorManager.class);return sm!=null&&sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)!=null;}
  static JSONObject status(Context c)throws Exception{return new JSONObject().put("supported",supported(c)).put("granted",granted(c)).put("running",running!=null);}
  static void start(Context c,String next,long base){
    if(!next.matches("[A-Za-z0-9_-]{1,128}") || base<0 || !granted(c) || !supported(c))throw new IllegalArgumentException();
    SharedPreferences p=store(c);
    if(!p.getBoolean("enabled",false) || !next.equals(p.getString("owner",""))){
      try{
        JSONObject days=new JSONObject(p.getString("days."+next,"{}"));
        days.put(LocalDate.now().toString(),base);
        if(!p.edit().putBoolean("enabled",true).putString("owner",next).putLong("last",-1).putString("days."+next,days.toString()).commit())throw new IllegalStateException();
      }catch(Exception e){throw new IllegalStateException(e);}
    }
    c.startForegroundService(new Intent(c,StepCounterService.class));
  }
  static void resume(Context c){SharedPreferences p=store(c);if(p.getBoolean("enabled",false)&&granted(c)&&supported(c))try{c.startForegroundService(new Intent(c,StepCounterService.class));}catch(Exception ignored){}}
  static void stop(Context c){store(c).edit().putBoolean("enabled",false).putLong("last",-1).commit();c.stopService(new Intent(c,StepCounterService.class));}
  static JSONObject read(Context c,String account)throws Exception{
    SharedPreferences p=store(c);
    if(!account.equals(p.getString("owner","")) || !p.getBoolean("enabled",false) || !granted(c))throw new SecurityException();
    JSONObject stored=new JSONObject(p.getString("days."+account,"{}")),days=new JSONObject();
    LocalDate today=LocalDate.now();
    for(int i=0;i<7;i++){String date=today.minusDays(i).toString();if(stored.has(date))days.put(date,stored.getLong(date));}
    return new JSONObject().put("days",days);
  }
  @Override public void onCreate(){super.onCreate();prefs=store(this);sensors=getSystemService(SensorManager.class);}
  @Override public int onStartCommand(Intent intent,int flags,int startId){
    if(!prefs.getBoolean("enabled",false)||!granted(this)||!supported(this)){stopSelf();return START_NOT_STICKY;}
    owner=prefs.getString("owner","");
    boolean en=getSharedPreferences("setwerk",0).getString("display-language","de").equals("en");
    NotificationManager nm=getSystemService(NotificationManager.class);
    NotificationChannel channel=new NotificationChannel(CHANNEL,en?"Step counter":"Schrittzähler",NotificationManager.IMPORTANCE_LOW);channel.setSound(null,null);nm.createNotificationChannel(channel);
    PendingIntent open=PendingIntent.getActivity(this,420,new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Notification note=new Notification.Builder(this,CHANNEL).setSmallIcon(at.setwerk.app.v2.R.drawable.ic_notify).setContentTitle(en?"Setwerk counts your steps":"Setwerk zählt deine Schritte").setContentText(en?"Phone steps · manage in Setwerk":"Handyschritte · in Setwerk verwalten").setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true).build();
    try{
      if(Build.VERSION.SDK_INT>=34)startForeground(NOTIFICATION,note,ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH);else startForeground(NOTIFICATION,note);
      if(!sensors.registerListener(this,sensors.getDefaultSensor(Sensor.TYPE_STEP_COUNTER),SensorManager.SENSOR_DELAY_NORMAL))throw new IllegalStateException();
      running=this;return START_STICKY;
    }catch(Exception e){stopSelf();return START_NOT_STICKY;}
  }
  @Override public void onSensorChanged(SensorEvent event){
    if(!prefs.getBoolean("enabled",false)||!granted(this)){stopSelf();return;}
    // Re-read owner: an account switch can precede the next onStartCommand.
    owner=prefs.getString("owner","");
    long raw=(long)event.values[0];int boot=Settings.Global.getInt(getContentResolver(),Settings.Global.BOOT_COUNT,0);
    long delta=StepCounterState.delta(prefs.getLong("last",-1),prefs.getInt("boot",boot),raw,boot);
    try{
      JSONObject days=new JSONObject(prefs.getString("days."+owner,"{}"));LocalDate today=LocalDate.now();String date=StepCounterState.eventDate(System.currentTimeMillis(),SystemClock.elapsedRealtimeNanos(),event.timestamp,ZoneId.systemDefault()).toString();
      days.put(date,days.optLong(date,0)+delta);
      Iterator<String> keys=days.keys();while(keys.hasNext()){String key=keys.next();if(key.compareTo(today.minusDays(6).toString())<0)keys.remove();}
      if(!prefs.edit().putLong("last",raw).putInt("boot",boot).putString("days."+owner,days.toString()).commit())stopSelf();
    }catch(Exception e){stopSelf();}
  }
  @Override public void onAccuracyChanged(Sensor sensor,int accuracy){}
  @Override public IBinder onBind(Intent intent){return null;}
  @Override public void onDestroy(){if(sensors!=null)sensors.unregisterListener(this);if(running==this)running=null;stopForeground(true);super.onDestroy();}
}
