package at.setwerk.app;
import android.app.*;import android.content.*;import android.os.Build;import org.json.*;import java.util.Calendar;
public class ReminderReceiver extends BroadcastReceiver {
  private static final String CHANNEL="setwerk_training";
  private static PendingIntent alarm(Context c,int id){return PendingIntent.getBroadcast(c,id,new Intent(c,ReminderReceiver.class).putExtra("alarmId",id),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
  private static boolean english(Context c){try{return "en".equals(c.getSharedPreferences("setwerk",0).getString("display-language",new JSONObject(c.getSharedPreferences("setwerk",0).getString("state","{}")).optString("language")));}catch(Exception e){return false;}}
  public static void createChannel(Context c){NotificationChannel ch=new NotificationChannel(CHANNEL,english(c)?"Training & rests":"Training & Pausen",NotificationManager.IMPORTANCE_DEFAULT);ch.setDescription(english(c)?"Training days and rest periods":"Trainingstage und Satzpausen");c.getSystemService(NotificationManager.class).createNotificationChannel(ch);}
  public static void cancelRest(Context c){c.getSystemService(AlarmManager.class).cancel(alarm(c,1));c.getSystemService(NotificationManager.class).cancel(1);}
  public static void scheduleRest(Context c,long until){if(until>System.currentTimeMillis())c.getSystemService(AlarmManager.class).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,until,alarm(c,1));}
  public static void scheduleAll(Context c){AlarmManager am=c.getSystemService(AlarmManager.class);for(int d=0;d<7;d++)am.cancel(alarm(c,100+d));
    try{JSONObject goals=new JSONObject(c.getSharedPreferences("setwerk",0).getString("goals","{}"));if(!goals.optBoolean("reminders"))return;JSONArray days=goals.getJSONArray("days");String[] time=goals.getString("time").split(":");int h=Integer.parseInt(time[0]),m=Integer.parseInt(time[1]);if(h<0||h>23||m<0||m>59)return;
      for(int i=0;i<days.length();i++){int d=days.getInt(i);if(d<0||d>6)continue;Calendar cal=Calendar.getInstance();cal.add(Calendar.DAY_OF_YEAR,(d-(cal.get(Calendar.DAY_OF_WEEK)-1)+7)%7);cal.set(Calendar.HOUR_OF_DAY,h);cal.set(Calendar.MINUTE,m);cal.set(Calendar.SECOND,0);cal.set(Calendar.MILLISECOND,0);if(cal.getTimeInMillis()<=System.currentTimeMillis()+1000)cal.add(Calendar.DAY_OF_YEAR,7);am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,cal.getTimeInMillis(),alarm(c,100+d));}
    }catch(Exception ignored){}
  }
  @Override public void onReceive(Context c,Intent intent){int id=intent.getIntExtra("alarmId",100);if(id!=1)scheduleAll(c);if(Build.VERSION.SDK_INT>=33&&c.checkSelfPermission("android.permission.POST_NOTIFICATIONS")!=0)return;
    createChannel(c);boolean en=english(c);PendingIntent open=PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Notification notification=new Notification.Builder(c,CHANNEL).setSmallIcon(at.setwerk.app.v2.R.drawable.ic_notify).setContentTitle(id==1?(en?"Your rest is over":"Deine Pause ist vorbei"):(en?"Your training day":"Dein Trainingstag")).setContentText(id==1?(en?"Ready for your next set?":"Bereit für deinen nächsten Satz?"):(en?"Time for your next session in Setwerk.":"Zeit für deine nächste Einheit in Setwerk.")).setContentIntent(open).setAutoCancel(true).build();c.getSystemService(NotificationManager.class).notify(id,notification);
  }
}
