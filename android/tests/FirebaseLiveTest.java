package at.setwerk.app;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.UUID;

/** Disposable account test against the configured Firebase project. Never logs credentials. */
public final class FirebaseLiveTest {
  static final class Memory implements FirebaseClient.Sessions {
    JSONObject value;
    public JSONObject read(){return value;}
    public void write(JSONObject value){this.value=value;}
  }
  static final class Http implements FirebaseClient.Transport {
    Runnable beforeCommit;
    public FirebaseClient.Result request(String address,String method,String body,String type,String token) throws Exception {
      if(beforeCommit!=null&&address.endsWith(":commit")){Runnable action=beforeCommit;beforeCommit=null;action.run();}
      HttpURLConnection conn=(HttpURLConnection)new URL(address).openConnection();conn.setInstanceFollowRedirects(false);conn.setConnectTimeout(15000);conn.setReadTimeout(35000);conn.setRequestMethod(method);
      conn.setRequestProperty("Accept","application/json");conn.setRequestProperty("Origin",FirebaseClient.SITE);conn.setRequestProperty("Referer",FirebaseClient.SITE+"/");
      if(token!=null)conn.setRequestProperty("Authorization","Bearer "+token);
      try{
        if(body!=null){byte[] bytes=body.getBytes(StandardCharsets.UTF_8);conn.setDoOutput(true);conn.setRequestProperty("Content-Type",type);conn.setFixedLengthStreamingMode(bytes.length);try(OutputStream out=conn.getOutputStream()){out.write(bytes);}}
        int status=conn.getResponseCode();InputStream input=status>=400?conn.getErrorStream():conn.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream();
        if(input!=null)try(InputStream in=input){byte[] bytes=new byte[8192];int n;while((n=in.read(bytes))!=-1)out.write(bytes,0,n);}
        return new FirebaseClient.Result(status,new String(out.toByteArray(),StandardCharsets.UTF_8));
      }finally{conn.disconnect();}
    }
  }
  static JSONObject invoke(FirebaseClient client,String operation,JSONObject body,int expected) throws Exception {
    FirebaseClient.Result result=client.call(operation,body.toString());
    if(result.status!=expected)throw new AssertionError(operation+" expected "+expected+" got "+result.status+" code "+new JSONObject(result.body).optString("code"));
    return new JSONObject(result.body);
  }
  static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
  public static void main(String[] args) throws Exception {
    JSONObject config=new JSONObject(new String(Files.readAllBytes(Paths.get(args[0])),StandardCharsets.UTF_8));
    String key=config.getString("apiKey"),email="setwerk-parity-"+UUID.randomUUID()+"@example.test",password="A1!"+UUID.randomUUID(),next="B2!"+UUID.randomUUID(),owner=null;
    Memory memory=new Memory();Http http=new Http();FirebaseClient client=new FirebaseClient(key,http,memory);
    try{
      JSONObject account=invoke(client,"identity-signup",new JSONObject().put("email",email).put("password",password).put("name","Android validation"),200);owner=account.getString("id");
      check(account.getString("name").equals("Android validation"),"Signup name");
      JSONObject own=new JSONObject().put("owner",owner);
      check(invoke(client,"cloud-read",own,200).getLong("revision")==0,"New account empty");
      JSONObject payload=new JSONObject(new String(Files.readAllBytes(Paths.get(args[1])),StandardCharsets.UTF_8));
      invoke(client,"cloud-write",new JSONObject().put("owner",owner).put("revision",0).put("data",payload),200);
      JSONObject stored=invoke(client,"cloud-read",own,200);check(stored.getJSONObject("data").getJSONArray("templates").getJSONObject(0).getString("sport").equals("Volleyball"),"Native snapshot read");
      System.out.println("PASS signup, account lookup and native Firestore read/write with server timestamps");

      Memory secondMemory=new Memory();FirebaseClient second=new FirebaseClient(key,new Http(),secondMemory);
      invoke(second,"identity-login",new JSONObject().put("email",email).put("password",password),200);
      check(invoke(second,"cloud-read",own,200).getJSONObject("data").getJSONArray("templates").length()==1,"Second client reads shared state");
      invoke(second,"cloud-write",new JSONObject().put("owner",owner).put("revision",1).put("data",payload),200);
      invoke(client,"cloud-write",new JSONObject().put("owner",owner).put("revision",1).put("data",payload),409);
      final String id=owner;final JSONObject copy=payload;
      http.beforeCommit=()->{try{invoke(second,"cloud-write",new JSONObject().put("owner",id).put("revision",2).put("data",copy),200);}catch(Exception error){throw new RuntimeException(error);}};
      invoke(client,"cloud-write",new JSONObject().put("owner",owner).put("revision",2).put("data",payload),409);
      check(invoke(client,"cloud-read",own,200).getLong("revision")==3,"Concurrent write preserved");
      System.out.println("PASS shared account state, revision conflict and actual concurrent commit precondition");

      invoke(client,"cloud-read",new JSONObject().put("owner","parity-different-owner"),401);
      FirebaseClient.Result forbidden=http.request("https://firestore.googleapis.com/v1/"+FirebaseClient.DOCUMENTS+"/users/parity-different-owner/state/main","GET",null,null,memory.value.getString("access"));
      check(forbidden.status==403,"Firestore rules reject another account");
      System.out.println("PASS client owner checks and deployed Firestore access rules");

      invoke(client,"identity-profile",new JSONObject().put("name","Updated validation"),200);
      check(invoke(client,"identity-user",new JSONObject(),200).getJSONObject("user").getString("name").equals("Updated validation"),"Updated name");
      invoke(client,"identity-password",new JSONObject().put("currentPassword",password).put("newPassword",next),200);password=next;
      memory.value.put("expires",0);
      check(invoke(client,"identity-user",new JSONObject(),200).getJSONObject("user").getString("id").equals(owner),"Refreshed identity");
      invoke(client,"identity-reauth",new JSONObject().put("password","wrong-password"),400);
      invoke(client,"identity-reauth",new JSONObject().put("password",password),200);
      System.out.println("PASS profile updates, reauthenticated password change and refresh-token exchange");

      JSONObject erased=invoke(client,"cloud-erase",own,200).getJSONObject("previous");
      invoke(client,"cloud-read",own,410);
      invoke(client,"cloud-restore",new JSONObject().put("owner",owner).put("revision",erased.getLong("revision")+1).put("data",erased.getJSONObject("data")),200);
      check(invoke(client,"cloud-read",own,200).getJSONObject("data").getJSONArray("templates").length()==1,"Deletion rollback preserved data");
      invoke(client,"cloud-erase",own,200);
      check(invoke(client,"cloud-erase",own,200).getJSONObject("previous").getJSONObject("data").getBoolean("deleted"),"Repeated deletion marker is accepted");
      invoke(client,"identity-delete",own,200);
      check(invoke(client,"identity-user",new JSONObject(),200).isNull("user"),"Deleted session cleared");
      invoke(client,"identity-login",new JSONObject().put("email",email).put("password",password),400);
      owner=null;
      System.out.println("PASS deletion marker, restoration after partial failure and final test-account cleanup");
    }finally{
      if(owner!=null){
        try{
          FirebaseClient.Result auth=client.call("identity-login",new JSONObject().put("email",email).put("password",password).toString());
          if(auth.status==200){client.call("cloud-erase",new JSONObject().put("owner",owner).toString());FirebaseClient.Result deleted=client.call("identity-delete",new JSONObject().put("owner",owner).toString());check(deleted.status==200,"Cleanup failed");System.out.println("Disposable account cleaned up after failed check");}
          else System.err.println("Disposable account cleanup could not authenticate");
        }catch(Exception error){System.err.println("Disposable account cleanup could not complete");}
      }
    }
  }
}
