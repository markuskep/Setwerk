package at.setwerk.app;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/** Firebase REST protocol; Android transport and encrypted storage are injected. */
final class FirebaseClient {
  static final String PROJECT = "setwerk-cb1e0";
  static final String PROJECT_NUMBER = "606853591538";
  static final String SITE = "https://setwerk-cb1e0.web.app";
  static final String DOCUMENTS = "projects/"+PROJECT+"/databases/(default)/documents";
  static final int MAX_BYTES = 800000;
  interface Transport { Result request(String url,String method,String body,String contentType,String token) throws Exception; }
  interface Sessions { JSONObject read() throws Exception; void write(JSONObject value) throws Exception; }
  static final class Result {
    final int status; final String body;
    Result(int status,String body){this.status=status;this.body=body;}
  }
  private static final class Failure extends Exception {
    final int status; final String code;
    Failure(int status,String code){this.status=status;this.code=code;}
  }
  private final String apiKey; private final Transport transport; private final Sessions sessions;
  FirebaseClient(String apiKey,Transport transport,Sessions sessions){this.apiKey=apiKey;this.transport=transport;this.sessions=sessions;}
  private JSONObject auth(String method,JSONObject body) throws Exception {
    Result result=transport.request("https://identitytoolkit.googleapis.com/v1/accounts:"+method+"?key="+apiKey,"POST",body.toString(),"application/json",null);
    return authResult(result);
  }
  private JSONObject authResult(Result result) throws Exception {
    JSONObject data=new JSONObject(result.body);
    if(result.status>=200&&result.status<300)return data;
    JSONObject error=data.optJSONObject("error");String message=error==null?"":error.optString("message").split(" : ")[0];
    String code="auth/network-request-failed";
    switch(message){
      case "INVALID_LOGIN_CREDENTIALS":case "INVALID_PASSWORD":case "EMAIL_NOT_FOUND":code="auth/invalid-credential";break;
      case "EMAIL_EXISTS":code="auth/email-already-in-use";break;
      case "INVALID_EMAIL":code="auth/invalid-email";break;
      case "WEAK_PASSWORD":code="auth/weak-password";break;
      case "PASSWORD_DOES_NOT_MEET_REQUIREMENTS":code="auth/password-does-not-meet-requirements";break;
      case "USER_DISABLED":code="auth/user-disabled";break;
      case "TOO_MANY_ATTEMPTS_TRY_LATER":code="auth/too-many-requests";break;
      case "OPERATION_NOT_ALLOWED":code="auth/operation-not-allowed";break;
      case "CONFIGURATION_NOT_FOUND":code="auth/configuration-not-found";break;
      case "INVALID_ID_TOKEN":case "TOKEN_EXPIRED":case "INVALID_REFRESH_TOKEN":case "USER_NOT_FOUND":case "CREDENTIAL_TOO_OLD_LOGIN_AGAIN":code="auth/requires-recent-login";break;
    }
    throw new Failure(code.equals("auth/requires-recent-login")?401:result.status,code);
  }
  private JSONObject publicUser(JSONObject profile) throws Exception {
    String id=profile.getString("localId");if(!id.matches("[A-Za-z0-9_-]{1,128}"))throw new IOException("Invalid user");
    return new JSONObject().put("id",id).put("email",profile.optString("email")).put("name",profile.optString("displayName"));
  }
  private JSONObject establish(JSONObject data,JSONObject previous) throws Exception {
    String access=data.getString("idToken");
    JSONObject profile=auth("lookup",new JSONObject().put("idToken",access)).getJSONArray("users").getJSONObject(0);
    JSONObject value=new JSONObject().put("access",access).put("refresh",data.optString("refreshToken",previous==null?"":previous.optString("refresh")))
      .put("expires",System.currentTimeMillis()+data.optLong("expiresIn",3600)*1000).put("user",publicUser(profile));
    if(previous!=null&&!previous.getJSONObject("user").getString("id").equals(value.getJSONObject("user").getString("id")))throw new Failure(401,"auth/requires-recent-login");
    return value;
  }
  private JSONObject ready() throws Exception {
    JSONObject value=sessions.read();if(value==null)throw new Failure(401,"auth/requires-recent-login");
    if(value.optLong("expires")<=System.currentTimeMillis()+60000){
      String body="grant_type=refresh_token&refresh_token="+URLEncoder.encode(value.getString("refresh"),"UTF-8");
      Result refreshed=transport.request("https://securetoken.googleapis.com/v1/token?key="+apiKey,"POST",body,"application/x-www-form-urlencoded",null);
      JSONObject data;
      try{data=authResult(refreshed);}catch(Failure error){if(error.status==401)sessions.write(null);throw error;}
      String project=data.getString("project_id");
      if(!(PROJECT.equals(project)||PROJECT_NUMBER.equals(project))||!value.getJSONObject("user").getString("id").equals(data.getString("user_id")))throw new Failure(401,"auth/requires-recent-login");
      JSONObject token=new JSONObject().put("idToken",data.getString("id_token")).put("refreshToken",data.getString("refresh_token")).put("expiresIn",data.getString("expires_in"));
      value=establish(token,value);sessions.write(value);
    }
    return value;
  }
  private JSONObject reauthenticate(String password) throws Exception {
    JSONObject previous=ready();
    JSONObject data=auth("signInWithPassword",new JSONObject().put("email",previous.getJSONObject("user").getString("email")).put("password",password).put("returnSecureToken",true));
    JSONObject value=establish(data,previous);sessions.write(value);return value;
  }
  private String owner(JSONObject value,String owner) throws Exception {
    if(!owner.matches("[A-Za-z0-9_-]{1,128}")||!value.getJSONObject("user").getString("id").equals(owner))throw new Failure(401,"auth/requires-recent-login");
    return DOCUMENTS+"/users/"+owner+"/state/main";
  }
  private Result storeHttp(String path,String method,JSONObject body,JSONObject value) throws Exception {
    Result response=transport.request("https://firestore.googleapis.com/v1/"+path,method,body==null?null:body.toString(),"application/json",value.getString("access"));
    if(response.status>=200&&response.status<300)return response;
    JSONObject error=new JSONObject(response.body).optJSONObject("error");String code=error==null?"":error.optString("status");
    if(method.equals("GET")&&response.status==404&&code.equals("NOT_FOUND"))return response;
    if(code.equals("FAILED_PRECONDITION")||code.equals("ABORTED")||code.equals("ALREADY_EXISTS"))throw new Failure(409,"setwerk/conflict");
    if(code.equals("RESOURCE_EXHAUSTED"))throw new Failure(429,"firestore/resource-exhausted");
    if(code.equals("UNAUTHENTICATED"))throw new Failure(401,"auth/requires-recent-login");
    if(code.equals("PERMISSION_DENIED"))throw new Failure(403,"firestore/permission-denied");
    throw new Failure(response.status,"setwerk/cloud-unavailable");
  }
  private JSONObject document(JSONObject value,String owner) throws Exception {
    Result result=storeHttp(owner(value,owner),"GET",null,value);
    return result.status==404?null:new JSONObject(result.body);
  }
  private JSONObject decode(JSONObject document,boolean restoring) throws Exception {
    if(document==null)return new JSONObject().put("revision",0).put("data",JSONObject.NULL);
    JSONObject fields=document.getJSONObject("fields");long revision=fields.getJSONObject("revision").getLong("integerValue");
    if(revision<1||revision>9007199254740991L)throw new Failure(422,"setwerk/invalid-cloud");
    JSONObject data=new JSONObject(fields.getJSONObject("payload").getString("stringValue"));
    if(data.optBoolean("deleted")&&!restoring)throw new Failure(410,"setwerk/deleted");
    return new JSONObject().put("revision",revision).put("data",data);
  }
  private JSONObject commit(JSONObject value,String owner,JSONObject document,long revision,JSONObject data) throws Exception {
    String payload=data.toString();if(payload.getBytes(StandardCharsets.UTF_8).length>MAX_BYTES)throw new Failure(413,"setwerk/too-large");
    if(revision<0||revision>=9007199254740991L)throw new Failure(422,"setwerk/invalid-revision");
    JSONObject condition=document==null?new JSONObject().put("exists",false):new JSONObject().put("updateTime",document.getString("updateTime"));
    JSONObject fields=new JSONObject().put("revision",new JSONObject().put("integerValue",String.valueOf(revision+1))).put("payload",new JSONObject().put("stringValue",payload));
    JSONObject write=new JSONObject().put("update",new JSONObject().put("name",owner(value,owner)).put("fields",fields)).put("currentDocument",condition)
      .put("updateTransforms",new JSONArray().put(new JSONObject().put("fieldPath","updatedAt").put("setToServerValue","REQUEST_TIME")));
    try{storeHttp(DOCUMENTS+":commit","POST",new JSONObject().put("writes",new JSONArray().put(write)),value);}
    catch(Failure error){
      // Firestore may evaluate revision rules before the update-time precondition.
      // Distinguish a concurrent write from a genuinely denied operation.
      if(error.status==403){
        boolean changed=false;
        try{
          JSONObject latest=document(value,owner);
          changed=decode(latest,true).getLong("revision")!=revision
            ||(document!=null&&latest!=null&&!document.getString("updateTime").equals(latest.getString("updateTime")));
        }catch(Exception ignored){}
        if(changed)throw new Failure(409,"setwerk/conflict");
      }
      throw error;
    }
    return new JSONObject().put("revision",revision+1).put("data",JSONObject.NULL);
  }
  synchronized Result call(String operation,String raw){
    try{
      JSONObject body=new JSONObject(raw==null||raw.isEmpty()?"{}":raw),value,data;
      switch(operation){
        case "identity-login":case "identity-signup":
          data=auth(operation.equals("identity-login")?"signInWithPassword":"signUp",new JSONObject().put("email",body.getString("email")).put("password",body.getString("password")).put("returnSecureToken",true));
          value=establish(data,null);sessions.write(value);
          if(operation.equals("identity-signup")&&!body.optString("name").isEmpty()){
            try{auth("update",new JSONObject().put("idToken",value.getString("access")).put("displayName",body.getString("name")));value.getJSONObject("user").put("name",body.getString("name"));sessions.write(value);}catch(Exception ignored){}
          }
          return ok(value.getJSONObject("user"));
        case "identity-user":
          if(sessions.read()==null)return ok(new JSONObject().put("user",JSONObject.NULL));
          try{value=ready();data=auth("lookup",new JSONObject().put("idToken",value.getString("access")));value.put("user",publicUser(data.getJSONArray("users").getJSONObject(0)));sessions.write(value);return ok(new JSONObject().put("user",value.getJSONObject("user")));}
          catch(Failure error){if(error.status==401){sessions.write(null);return ok(new JSONObject().put("user",JSONObject.NULL));}throw error;}
        case "identity-logout":sessions.write(null);return ok(new JSONObject());
        case "identity-reset":
          try{auth("sendOobCode",new JSONObject().put("requestType","PASSWORD_RESET").put("email",body.getString("email")));}catch(Failure error){if(!error.code.equals("auth/invalid-credential"))throw error;}return ok(new JSONObject());
        case "identity-profile":
          value=ready();auth("update",new JSONObject().put("idToken",value.getString("access")).put("displayName",body.getString("name")));value.getJSONObject("user").put("name",body.getString("name"));sessions.write(value);return ok(value.getJSONObject("user"));
        case "identity-reauth":value=reauthenticate(body.getString("password"));return ok(value.getJSONObject("user"));
        case "identity-password":
          value=reauthenticate(body.getString("currentPassword"));data=auth("update",new JSONObject().put("idToken",value.getString("access")).put("password",body.getString("newPassword")).put("returnSecureToken",true));value=establish(data,value);sessions.write(value);return ok(new JSONObject());
        case "identity-delete":
          value=ready();owner(value,body.getString("owner"));auth("delete",new JSONObject().put("idToken",value.getString("access")));sessions.write(null);return ok(new JSONObject());
        case "cloud-read":case "cloud-write":case "cloud-erase":case "cloud-restore":
          value=ready();String owner=body.getString("owner");JSONObject document=document(value,owner);
          JSONObject current=decode(document,operation.equals("cloud-restore"));long revision=current.getLong("revision");
          if(operation.equals("cloud-read"))return ok(current);
          if(operation.equals("cloud-erase")){
            if(document==null)return ok(new JSONObject().put("previous",JSONObject.NULL));
            commit(value,owner,document,revision,new JSONObject().put("deleted",true));return ok(new JSONObject().put("previous",current));
          }
          if(operation.equals("cloud-restore")&&(current.optJSONObject("data")==null||!current.getJSONObject("data").optBoolean("deleted")))throw new Failure(409,"setwerk/conflict");
          if(revision!=body.getLong("revision"))throw new Failure(409,"setwerk/conflict");
          return ok(commit(value,owner,document,revision,body.getJSONObject("data")));
        default:return new Result(403,"{\"code\":\"setwerk/blocked\"}");
      }
    }catch(Failure error){return error(error.status,error.code);}
    catch(Exception error){return error(502,"auth/network-request-failed");}
  }
  private Result ok(JSONObject data){return new Result(200,data.toString());}
  private Result error(int status,String code){try{return new Result(status,new JSONObject().put("code",code).toString());}catch(Exception ignored){return new Result(502,"{}");}}
}
