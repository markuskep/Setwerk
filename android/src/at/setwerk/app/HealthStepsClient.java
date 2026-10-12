package at.setwerk.app;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.health.connect.*;
import android.health.connect.datatypes.StepsRecord;
import android.os.OutcomeReceiver;
import org.json.JSONObject;
import java.time.*;
import java.util.concurrent.Executor;

/** Platform Health Connect adapter, instantiated only on Android 14+. */
final class HealthStepsClient {
  static final String READ_STEPS="android.permission.health.READ_STEPS";
  interface Reply { void send(int status, String body); }
  private final Activity activity;
  private final Executor executor;
  private Reply permissionReply;
  HealthStepsClient(Activity activity, Executor executor){this.activity=activity;this.executor=executor;}
  private HealthConnectManager manager(){return activity.getSystemService(HealthConnectManager.class);}
  private boolean granted(){return activity.checkSelfPermission(READ_STEPS)==PackageManager.PERMISSION_GRANTED;}
  void status(Reply reply){
    try{reply.send(200,new JSONObject().put("supported",manager()!=null).put("granted",granted()).toString());}
    catch(Exception e){reply.send(200,"{\"supported\":false,\"granted\":false}");}
  }
  void connect(Reply reply){
    if(manager()==null){reply.send(503,"{\"code\":\"health/unavailable\"}");return;}
    if(granted()){status(reply);return;}
    if(permissionReply!=null){reply.send(409,"{\"code\":\"health/busy\"}");return;}
    permissionReply=reply;
    try{activity.requestPermissions(new String[]{READ_STEPS},83);}
    catch(Exception e){permissionReply=null;reply.send(503,"{\"code\":\"health/unavailable\"}");}
  }
  void permissionResult(){Reply reply=permissionReply;permissionReply=null;if(reply!=null)status(reply);}
  void settings(Reply reply){
    try{activity.startActivity(new Intent(HealthConnectManager.ACTION_MANAGE_HEALTH_PERMISSIONS).putExtra(Intent.EXTRA_PACKAGE_NAME,activity.getPackageName()));reply.send(200,"{}");}
    catch(Exception e){reply.send(503,"{\"code\":\"health/unavailable\"}");}
  }
  void read(Reply reply){
    if(!granted()){reply.send(403,"{\"code\":\"health/permission-denied\"}");return;}
    final ZoneId zone=ZoneId.systemDefault();final Instant now=Instant.now();
    final LocalDate today=now.atZone(zone).toLocalDate();
    readDay(today.minusDays(6),today,zone,now,new JSONObject(),reply);
  }
  private void readDay(LocalDate day,LocalDate today,ZoneId zone,Instant now,JSONObject days,Reply reply){
    if(!granted()){reply.send(403,"{\"code\":\"health/permission-denied\"}");return;}
    Instant start=day.atStartOfDay(zone).toInstant();
    Instant end=day.equals(today)?now:day.plusDays(1).atStartOfDay(zone).toInstant();
    if(!end.isAfter(start)){finish(days,reply);return;}
    try{
      AggregateRecordsRequest<Long> request=new AggregateRecordsRequest.Builder<Long>(new TimeInstantRangeFilter.Builder().setStartTime(start).setEndTime(end).build()).addAggregationType(StepsRecord.STEPS_COUNT_TOTAL).build();
      // The aggregate API removes overlapping sources. Never sum raw phone/watch records.
      manager().aggregate(request,executor,new OutcomeReceiver<AggregateRecordsResponse<Long>,HealthConnectException>(){
        @Override public void onResult(AggregateRecordsResponse<Long> result){
          try{
            Long count=result.get(StepsRecord.STEPS_COUNT_TOTAL);
            // A missing aggregate is not a recorded zero: preserve existing manual entries.
            if(count!=null&&count>=0)days.put(day.toString(),count);
            if(day.equals(today))finish(days,reply);else readDay(day.plusDays(1),today,zone,now,days,reply);
          }catch(Exception e){fail(reply);}
        }
        @Override public void onError(HealthConnectException error){fail(reply);}
      });
    }catch(Exception e){fail(reply);}
  }
  private void finish(JSONObject days,Reply reply){
    try{reply.send(200,new JSONObject().put("days",days).toString());}catch(Exception e){fail(reply);}
  }
  private void fail(Reply reply){reply.send(granted()?503:403,granted()?"{\"code\":\"health/read-failed\"}":"{\"code\":\"health/permission-denied\"}");}
}
