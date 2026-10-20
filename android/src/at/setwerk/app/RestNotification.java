package at.setwerk.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.widget.RemoteViews;

/** SystemUI runs an explicit countdown in both notification sizes, independent of the Activity. */
public final class RestNotification {
  private static final String CHANNEL="setwerk_rest_running";
  private static final int ID=2;
  private RestNotification(){}
  public static void hide(Context c){c.getSystemService(NotificationManager.class).cancel(ID);}
  public static void show(Context c,long until){
    long remaining=until-System.currentTimeMillis();
    if(remaining<=0){hide(c);return;}
    if(Build.VERSION.SDK_INT>=33&&c.checkSelfPermission("android.permission.POST_NOTIFICATIONS")!=0)return;
    boolean en="en".equals(c.getSharedPreferences("setwerk",0).getString("display-language","de"));
    NotificationManager manager=c.getSystemService(NotificationManager.class);
    NotificationChannel channel=new NotificationChannel(CHANNEL,en?"Running rest timer":"Laufender Pausentimer",NotificationManager.IMPORTANCE_LOW);
    channel.setSound(null,null);channel.enableVibration(false);manager.createNotificationChannel(channel);
    Intent intent=new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
    PendingIntent open=PendingIntent.getActivity(c,ID,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    // Do not rely on the small timestamp/chronometer in the OEM notification header.
    // Chronometer bases use elapsedRealtime, while the stored workout deadline is wall-clock time.
    long elapsedDeadline=SystemClock.elapsedRealtime()+remaining;
    RemoteViews timer=new RemoteViews(c.getPackageName(),at.setwerk.app.v2.R.layout.notification_rest);
    timer.setTextViewText(at.setwerk.app.v2.R.id.rest_label,en?"Rest timer":"Satzpause");
    timer.setTextViewText(at.setwerk.app.v2.R.id.rest_hint,en?"Tap to return to your workout":"Zurück zum Training");
    timer.setChronometerCountDown(at.setwerk.app.v2.R.id.rest_countdown,true);
    timer.setChronometer(at.setwerk.app.v2.R.id.rest_countdown,elapsedDeadline,null,true);
    Notification notification=new Notification.Builder(c,CHANNEL)
      .setSmallIcon(at.setwerk.app.v2.R.drawable.ic_notify)
      .setContentTitle(en?"Rest timer":"Satzpause")
      .setContentText(en?"Remaining rest time":"Verbleibende Pausenzeit")
      .setStyle(new Notification.DecoratedCustomViewStyle())
      .setCustomContentView(timer).setCustomBigContentView(timer.clone())
      .setCategory(Notification.CATEGORY_STOPWATCH).setVisibility(Notification.VISIBILITY_PUBLIC)
      .setWhen(until).setShowWhen(true).setUsesChronometer(true).setChronometerCountDown(true)
      .setTimeoutAfter(remaining).setOnlyAlertOnce(true).setOngoing(true).setContentIntent(open).build();
    manager.notify(ID,notification);
  }
}
