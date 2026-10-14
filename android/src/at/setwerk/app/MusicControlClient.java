package at.setwerk.app;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.media.MediaDescription;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSession;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.provider.Settings;
import org.json.JSONObject;
import java.util.List;

/** Controls the active external media session; all calls run on the UI thread. */
public final class MusicControlClient {
  private final Activity activity;
  private final ComponentName listener;
  // AndroidX MediaSessionCompat's queue-command contract. This index-only command
  // avoids requiring a MediaDescriptionCompat parcel or another SDK dependency.
  // Source: https://android.googlesource.com/platform/frameworks/support/+/65cde2c4554985493a2e7560b5e71c5f24969287%5E%21/
  private static final long HANDLES_QUEUE_COMMANDS = 4;
  private static final String REMOVE_AT = "android.support.v4.media.session.command.REMOVE_QUEUE_ITEM_AT";
  private static final String ARG_INDEX = "android.support.v4.media.session.command.ARGUMENT_INDEX";
  public MusicControlClient(Activity activity) {
    this.activity = activity;
    listener = new ComponentName(activity, MusicNotificationListener.class);
  }
  private boolean granted() {
    if (Build.VERSION.SDK_INT >= 27) return ((NotificationManager)activity.getSystemService(Context.NOTIFICATION_SERVICE)).isNotificationListenerAccessGranted(listener);
    String enabled = Settings.Secure.getString(activity.getContentResolver(), "enabled_notification_listeners");
    if (enabled != null) for (String name : enabled.split(":")) if (listener.equals(ComponentName.unflattenFromString(name))) return true;
    return false;
  }
  private MediaController active() {
    if (!granted()) return null;
    MediaSessionManager manager = (MediaSessionManager)activity.getSystemService(Context.MEDIA_SESSION_SERVICE);
    List<MediaController> sessions = manager.getActiveSessions(listener);
    MediaController fallback = null;
    for (MediaController controller : sessions) {
      if (controller.getPackageName().equals(activity.getPackageName())) continue;
      PlaybackState playback = controller.getPlaybackState();
      if (playback != null && playback.getState() == PlaybackState.STATE_PLAYING) return controller;
      if (fallback == null && playback != null && (playback.getState() == PlaybackState.STATE_PAUSED || playback.getState() == PlaybackState.STATE_BUFFERING || playback.getState() == PlaybackState.STATE_CONNECTING)) fallback = controller;
    }
    return fallback;
  }
  private static String sessionKey(MediaController controller) {
    return controller.getPackageName() + ":" + controller.getSessionToken().hashCode();
  }
  private static String text(CharSequence value) {
    if (value == null) return "";
    String string = value.toString();
    return string.length() > 512 ? string.substring(0, 512) : string;
  }
  private int nextIndex(MediaController controller) {
    List<MediaSession.QueueItem> queue = controller.getQueue();
    if (queue == null || queue.isEmpty()) return -1;
    long[] ids = new long[queue.size()]; String[] mediaIds = new String[queue.size()];
    for (int i = 0; i < queue.size(); i++) { ids[i] = queue.get(i).getQueueId(); mediaIds[i] = queue.get(i).getDescription().getMediaId(); }
    PlaybackState playback = controller.getPlaybackState();
    MediaMetadata metadata = controller.getMetadata();
    return MusicQueuePolicy.nextIndex(ids, playback == null ? -1 : playback.getActiveQueueItemId(), mediaIds, metadata == null ? null : metadata.getString(MediaMetadata.METADATA_KEY_MEDIA_ID));
  }
  private String appName(MediaController controller) {
    try { return text(activity.getPackageManager().getApplicationLabel(activity.getPackageManager().getApplicationInfo(controller.getPackageName(), 0))); }
    catch (Exception ignored) { return controller.getPackageName(); }
  }
  public JSONObject state() throws Exception {
    JSONObject data = new JSONObject().put("supported", true).put("granted", granted()).put("active", false);
    MediaController controller = active();
    if (controller == null) return data;
    PlaybackState playback = controller.getPlaybackState(); MediaMetadata metadata = controller.getMetadata();
    long actions = playback == null ? 0 : playback.getActions();
    boolean playing = playback != null && playback.getState() == PlaybackState.STATE_PLAYING;
    long duration = metadata == null ? 0 : Math.max(0, metadata.getLong(MediaMetadata.METADATA_KEY_DURATION));
    long updated = playback == null ? 0 : playback.getLastPositionUpdateTime();
    long elapsed = updated > 0 ? Math.max(0, SystemClock.elapsedRealtime() - updated) : 0;
    long position = MusicQueuePolicy.position(playback == null ? 0 : playback.getPosition(), elapsed, playback == null ? 0 : playback.getPlaybackSpeed(), playing, duration);
    data.put("active", true).put("sessionKey", sessionKey(controller)).put("appName", appName(controller)).put("playing", playing)
      .put("title", metadata == null ? "" : text(metadata.getDescription().getTitle()))
      .put("artist", metadata == null ? "" : text(metadata.getString(MediaMetadata.METADATA_KEY_ARTIST)))
      .put("position", position).put("duration", duration).put("speed", playback == null ? 0 : playback.getPlaybackSpeed())
      .put("canPlay", (actions & (PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PLAY_PAUSE)) != 0)
      .put("canPause", (actions & (PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE)) != 0)
      .put("canPrevious", (actions & PlaybackState.ACTION_SKIP_TO_PREVIOUS) != 0)
      .put("canNext", (actions & PlaybackState.ACTION_SKIP_TO_NEXT) != 0)
      .put("canSeek", duration > 0 && (actions & PlaybackState.ACTION_SEEK_TO) != 0);
    int next = nextIndex(controller); List<MediaSession.QueueItem> queue = controller.getQueue();
    if (next >= 0 && queue != null && next < queue.size()) {
      MediaSession.QueueItem item = queue.get(next); MediaDescription description = item.getDescription();
      data.put("next", new JSONObject().put("id", String.valueOf(item.getQueueId())).put("title", text(description.getTitle())).put("artist", text(description.getSubtitle())))
        .put("canRemoveNext", (controller.getFlags() & HANDLES_QUEUE_COMMANDS) != 0);
    }
    return data;
  }
  public JSONObject call(String operation, JSONObject input) throws Exception {
    if (operation.equals("music-state")) return state();
    if (operation.equals("music-connect")) {
      Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
      if (Build.VERSION.SDK_INT >= 30) intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS).putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, listener.flattenToString());
      try { activity.startActivity(intent); }
      catch (android.content.ActivityNotFoundException error) { activity.startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)); }
      return new JSONObject();
    }
    if (!granted()) throw new IllegalArgumentException("music/access-denied");
    MediaController controller = active();
    if (controller == null || !sessionKey(controller).equals(input.optString("sessionKey"))) throw new IllegalArgumentException("music/session-changed");
    PlaybackState playback = controller.getPlaybackState(); long actions = playback == null ? 0 : playback.getActions();
    MediaController.TransportControls controls = controller.getTransportControls();
    if (operation.equals("music-remove-next")) {
      if ((controller.getFlags() & HANDLES_QUEUE_COMMANDS) == 0) throw new IllegalArgumentException("music/unsupported");
      int next = nextIndex(controller); List<MediaSession.QueueItem> queue = controller.getQueue();
      if (next < 0 || queue == null || next >= queue.size() || !String.valueOf(queue.get(next).getQueueId()).equals(input.optString("nextId"))) throw new IllegalArgumentException("music/queue-changed");
      Bundle args = new Bundle(); args.putInt(ARG_INDEX, next); controller.sendCommand(REMOVE_AT, args, null);
      // Sending is not an acknowledgement: the UI waits for the queue to change.
      return new JSONObject().put("requested", true);
    }
    if (operation.equals("music-play") && (actions & (PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PLAY_PAUSE)) != 0) controls.play();
    else if (operation.equals("music-pause") && (actions & (PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE)) != 0) controls.pause();
    else if (operation.equals("music-previous") && (actions & PlaybackState.ACTION_SKIP_TO_PREVIOUS) != 0) controls.skipToPrevious();
    else if (operation.equals("music-next") && (actions & PlaybackState.ACTION_SKIP_TO_NEXT) != 0) controls.skipToNext();
    else if (operation.equals("music-seek") && (actions & PlaybackState.ACTION_SEEK_TO) != 0) {
      MediaMetadata metadata = controller.getMetadata(); long duration = metadata == null ? 0 : metadata.getLong(MediaMetadata.METADATA_KEY_DURATION);
      if (duration <= 0) throw new IllegalArgumentException("music/unsupported");
      controls.seekTo(Math.max(0, Math.min(input.getLong("position"), duration)));
    } else throw new IllegalArgumentException("music/unsupported");
    return new JSONObject().put("requested", true);
  }
}
