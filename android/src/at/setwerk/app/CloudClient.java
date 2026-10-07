package at.setwerk.app;
import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;

// Tokens stay encrypted in Android Keystore-backed storage; passwords are never persisted.
final class CloudClient {
  private final SharedPreferences prefs;
  private final FirebaseClient firebase;
  private static final String KEY_ALIAS = "setwerk.identity.v1";
  private static final String API_KEY = "AIzaSyDcvt43ekvN9WDgaIwkBNp2ZdEVUPQZLN0";
  CloudClient(Context context) {
    prefs=context.getSharedPreferences("setwerk-cloud",Context.MODE_PRIVATE);
    firebase=new FirebaseClient(API_KEY,this::http,new FirebaseClient.Sessions(){
      public JSONObject read() throws Exception {return session();}
      public void write(JSONObject value) throws Exception {persist(value);}
    });
  }
  String site(){return FirebaseClient.SITE;}
  void language(String value){prefs.edit().putString("language",value.equals("en")?"en":"de").apply();}
  FirebaseClient.Result call(String operation,String raw){return firebase.call(operation,raw);}
  private SecretKey key() throws Exception {
    KeyStore store=KeyStore.getInstance("AndroidKeyStore"); store.load(null);
    if (store.containsAlias(KEY_ALIAS)) return (SecretKey)store.getKey(KEY_ALIAS,null);
    KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
    generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
    return generator.generateKey();
  }
  private String sessionKey() { return "session."+site(); }
  private JSONObject session() throws Exception {
    String encoded=prefs.getString(sessionKey(),null); if(encoded==null)return null;
    JSONObject envelope=new JSONObject(encoded);
    Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(envelope.getString("iv"),Base64.NO_WRAP)));
    cipher.updateAAD(site().getBytes(StandardCharsets.UTF_8));
    return new JSONObject(new String(cipher.doFinal(Base64.decode(envelope.getString("data"),Base64.NO_WRAP)),StandardCharsets.UTF_8));
  }
  private void persist(JSONObject value) throws Exception {
    if(value==null){if(!prefs.edit().remove(sessionKey()).commit())throw new IOException("storage");return;}
    Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE,key());
    cipher.updateAAD(site().getBytes(StandardCharsets.UTF_8));
    JSONObject envelope=new JSONObject().put("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)).put("data",Base64.encodeToString(cipher.doFinal(value.toString().getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP));
    if(!prefs.edit().putString(sessionKey(),envelope.toString()).commit())throw new IOException("storage");
  }
  private FirebaseClient.Result http(String address,String method,String body,String contentType,String token) throws Exception {
    URL url=new URL(address);
    if(!"https".equals(url.getProtocol())||url.getPort()!=-1||url.getUserInfo()!=null||!Arrays.asList("identitytoolkit.googleapis.com","securetoken.googleapis.com","firestore.googleapis.com").contains(url.getHost()))throw new IOException("Blocked destination");
    HttpURLConnection conn=(HttpURLConnection)url.openConnection();
    conn.setInstanceFollowRedirects(false);conn.setConnectTimeout(15000);conn.setReadTimeout(35000);conn.setRequestMethod(method);
    conn.setRequestProperty("Accept","application/json");conn.setRequestProperty("Origin",site());conn.setRequestProperty("Referer",site()+"/");
    conn.setRequestProperty("X-Firebase-Locale",prefs.getString("language","de"));
    if(token!=null){if(!token.matches("[A-Za-z0-9_.-]+"))throw new IOException("Invalid token");conn.setRequestProperty("Authorization","Bearer "+token);}
    try{
      if(body!=null){byte[] bytes=body.getBytes(StandardCharsets.UTF_8);if(bytes.length>3*1024*1024)throw new IOException("Too large");conn.setDoOutput(true);conn.setRequestProperty("Content-Type",contentType);conn.setFixedLengthStreamingMode(bytes.length);try(OutputStream out=conn.getOutputStream()){out.write(bytes);}}
      int status=conn.getResponseCode();if(status>=300&&status<400)throw new IOException("Redirect blocked");
      InputStream input=status>=400?conn.getErrorStream():conn.getInputStream();if(input==null)return new FirebaseClient.Result(status,"{}");
      ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int count;
      try(InputStream in=input){while((count=in.read(buffer))!=-1){if(out.size()+count>3*1024*1024)throw new IOException("Too large");out.write(buffer,0,count);}}
      String response=new String(out.toByteArray(),StandardCharsets.UTF_8);new JSONObject(response);return new FirebaseClient.Result(status,response);
    }finally{conn.disconnect();}
  }
}
