package at.setwerk.app;

/** Pure queue policy shared by the Android adapter and its targeted tests. */
public final class MusicQueuePolicy {
  private MusicQueuePolicy() {}
  public static int nextIndex(long[] ids, long currentId, String[] mediaIds, String currentMediaId) {
    if (ids == null) return -1;
    int current = -1;
    if (currentId != -1) {
      for (int i = 0; i < ids.length; i++) if (ids[i] == currentId) {
        if (current != -1) return -1;
        current = i;
      }
    }
    if (current == -1 && currentMediaId != null && !currentMediaId.isEmpty() && mediaIds != null) {
      for (int i = 0; i < Math.min(ids.length, mediaIds.length); i++) if (currentMediaId.equals(mediaIds[i])) {
        if (current != -1) return -1;
        current = i;
      }
    }
    return current >= 0 && current + 1 < ids.length ? current + 1 : -1;
  }
  public static long position(long position, long elapsed, float speed, boolean playing, long duration) {
    long value = Math.max(0, position);
    if (playing && elapsed > 0 && !Float.isNaN(speed) && !Float.isInfinite(speed)) value = Math.max(0, value + (long)(elapsed * speed));
    return duration > 0 ? Math.min(value, duration) : value;
  }
}
