#!/usr/bin/env python3
"""Run the real notification builder against a small, recording Android test double.

This checks the native payload and clock conversion, not an OEM's visual rendering.
The APK build separately compiles against the real Android API and XML resources.
"""
import argparse
from pathlib import Path
import subprocess
import tempfile
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--compiler', help='ECJ jar when javac is unavailable')
args = parser.parse_args()

stubs = {
 'android/os/Build.java': '''package android.os; public class Build {public static class VERSION {public static int SDK_INT=35;}}''',
 'android/os/SystemClock.java': '''package android.os; public class SystemClock {public static long now=1234567;public static long elapsedRealtime(){return now;}}''',
 'android/content/SharedPreferences.java': '''package android.content; public class SharedPreferences {public String language="de";public String getString(String key,String fallback){return language;}}''',
 'android/content/Context.java': '''package android.content; public class Context {
 public final android.app.NotificationManager manager=new android.app.NotificationManager();public final SharedPreferences prefs=new SharedPreferences();public int permission=0;
 public <T>T getSystemService(Class<T> type){return type.cast(manager);}public int checkSelfPermission(String permission){return this.permission;}
 public SharedPreferences getSharedPreferences(String name,int mode){return prefs;}public String getPackageName(){return "at.setwerk.app.v2";}
 }''',
 'android/content/Intent.java': '''package android.content; public class Intent {public static final int FLAG_ACTIVITY_NEW_TASK=1,FLAG_ACTIVITY_CLEAR_TOP=2,FLAG_ACTIVITY_SINGLE_TOP=4;public Intent(Context c,Class<?> type){}public Intent addFlags(int flags){return this;}}''',
 'android/app/PendingIntent.java': '''package android.app; import android.content.*;public class PendingIntent {public static final int FLAG_UPDATE_CURRENT=1,FLAG_IMMUTABLE=2;public static PendingIntent getActivity(Context c,int id,Intent i,int flags){return new PendingIntent();}}''',
 'android/app/NotificationChannel.java': '''package android.app;public class NotificationChannel {public NotificationChannel(String id,String title,int importance){}public void setSound(Object sound,Object attributes){}public void enableVibration(boolean enabled){}}''',
 'android/app/NotificationManager.java': '''package android.app;public class NotificationManager {public static final int IMPORTANCE_LOW=2;public Notification posted;public int cancelled=-1,postCount=0;public void cancel(int id){cancelled=id;posted=null;}public void createNotificationChannel(NotificationChannel c){}public void notify(int id,Notification n){posted=n;postCount++;}}''',
 'android/widget/RemoteViews.java': '''package android.widget;import java.util.*;public class RemoteViews {
 public final int layout;public final Map<Integer,CharSequence> texts=new HashMap<>();public int timerId;public long base;public boolean started,countDown;
 public RemoteViews(String pkg,int layout){this.layout=layout;}public void setTextViewText(int id,CharSequence text){texts.put(id,text);}
 public void setChronometerCountDown(int id,boolean value){timerId=id;countDown=value;}public void setChronometer(int id,long base,String format,boolean started){timerId=id;this.base=base;this.started=started;}
 public RemoteViews clone(){RemoteViews out=new RemoteViews("at.setwerk.app.v2",layout);out.texts.putAll(texts);out.timerId=timerId;out.base=base;out.started=started;out.countDown=countDown;return out;}
 }''',
 'android/app/Notification.java': '''package android.app;import android.content.Context;import android.widget.RemoteViews;public class Notification {
 public static final String CATEGORY_STOPWATCH="stopwatch";public static final int VISIBILITY_PUBLIC=1;
 public RemoteViews compact,expanded;public boolean decorated;public long timeout;public PendingIntent open;
 public static class DecoratedCustomViewStyle{}
 public static class Builder {private final Notification n=new Notification();public Builder(Context c,String channel){}
 public Builder setSmallIcon(int icon){return this;}public Builder setContentTitle(CharSequence text){return this;}public Builder setContentText(CharSequence text){return this;}
 public Builder setCategory(String category){return this;}public Builder setVisibility(int visibility){return this;}public Builder setWhen(long when){return this;}
 public Builder setShowWhen(boolean enabled){return this;}public Builder setUsesChronometer(boolean enabled){return this;}public Builder setChronometerCountDown(boolean enabled){return this;}
 public Builder setTimeoutAfter(long timeout){n.timeout=timeout;return this;}public Builder setOnlyAlertOnce(boolean enabled){return this;}public Builder setOngoing(boolean enabled){return this;}
 public Builder setContentIntent(PendingIntent open){n.open=open;return this;}public Builder setStyle(DecoratedCustomViewStyle style){n.decorated=true;return this;}
 public Builder setCustomContentView(RemoteViews view){n.compact=view;return this;}public Builder setCustomBigContentView(RemoteViews view){n.expanded=view;return this;}
 public Notification build(){return n;}}
 }''',
 'at/setwerk/app/MainActivity.java': '''package at.setwerk.app;public class MainActivity {}''',
 'at/setwerk/app/v2/R.java': '''package at.setwerk.app.v2;public class R {public static class drawable {public static final int ic_notify=1;}public static class layout {public static final int notification_rest=2;}public static class id {public static final int rest_label=3,rest_hint=4,rest_countdown=5;}}''',
 'at/setwerk/app/RestNotificationCheck.java': '''package at.setwerk.app;
 import android.app.*;import android.content.*;import android.os.*;import android.widget.*;import at.setwerk.app.v2.R;
 public class RestNotificationCheck {
 static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
 static void timer(RemoteViews view){check(view!=null,"Visible timer view is missing");check(view.layout==R.layout.notification_rest,"Wrong timer layout");check(view.timerId==R.id.rest_countdown,"Countdown not connected to visible widget");check(view.started&&view.countDown,"Visible timer is not a running countdown");}
 public static void main(String[] args){
 Context c=new Context();long until=System.currentTimeMillis()+90000;RestNotification.show(c,until);Notification n=c.manager.posted;
 check(n!=null,"No notification posted");timer(n.compact);timer(n.expanded);check(n.decorated,"System notification decoration is missing");check(n.open!=null,"Notification cannot reopen workout");
 check(n.compact.base==n.expanded.base,"Compact/expanded deadlines disagree");check(Math.abs((n.compact.base-SystemClock.now)-90000)<1000,"Countdown uses wall time instead of monotonic time");
 SystemClock.now+=61000;check(Math.abs((n.compact.base-SystemClock.now)-29000)<1000,"Countdown does not progress independently of Activity updates");check(n.timeout>89000&&n.timeout<=90000,"Notification does not expire with the rest");
 check("Satzpause".contentEquals(n.compact.texts.get(R.id.rest_label)),"German label missing");
 RestNotification.hide(c);check(c.manager.posted==null&&c.manager.cancelled==2,"Cancel leaves stale countdown");
 RestNotification.show(c,System.currentTimeMillis()-1);check(c.manager.posted==null,"Expired rest posts a countdown");
 c.permission=-1;RestNotification.show(c,System.currentTimeMillis()+30000);check(c.manager.posted==null,"Notification posted without Android 13+ permission");
 c.permission=0;c.prefs.language="en";RestNotification.show(c,System.currentTimeMillis()+30000);check("Rest timer".contentEquals(c.manager.posted.compact.texts.get(R.id.rest_label)),"English label missing");
 RestNotification.hide(c);Build.VERSION.SDK_INT=26;c.permission=-1;RestNotification.show(c,System.currentTimeMillis()+1000);timer(c.manager.posted.compact);
 System.out.println("Native notification checks passed: compact/expanded countdown, monotonic deadline, independent progression, expiry, cancellation, permission, localization and Android 8 compatibility");
 }}'''
}

ns = {'a': 'http://schemas.android.com/apk/res/android'}
layout = ET.parse(root/'res/layout/notification_rest.xml').getroot()
counter = layout.find('Chronometer')
assert counter is not None and counter.get('{%s}id' % ns['a']) == '@+id/rest_countdown'
assert counter.get('{%s}visibility' % ns['a'], 'visible') == 'visible'
assert layout.get('{%s}layout_height' % ns['a']) == '48dp'

with tempfile.TemporaryDirectory(prefix='setwerk-rest-native-') as directory:
    temp = Path(directory)
    for name, text in stubs.items():
        file = temp/name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(text)
    source = temp/'at/setwerk/app/RestNotification.java'
    source.write_text((root/'src/at/setwerk/app/RestNotification.java').read_text())
    classes = temp/'classes'
    classes.mkdir()
    sources = [str(p) for p in temp.rglob('*.java')]
    compiler = ['java','-jar',args.compiler,'-8','-proc:none','-warn:none'] if args.compiler else ['javac','--release','8']
    subprocess.run(compiler+['-d',str(classes)]+sources, check=True)
    subprocess.run(['java','-cp',str(classes),'at.setwerk.app.RestNotificationCheck'], check=True)
