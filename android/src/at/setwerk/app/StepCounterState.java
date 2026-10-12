package at.setwerk.app;
import java.time.*;

/** Sensor totals are cumulative per boot, not a daily count. */
final class StepCounterState {
  static long delta(long previous, int previousBoot, long current, int boot) {
    if(current<0 || previous<0)return 0; // First observation establishes the baseline.
    if(previousBoot!=boot || current<previous)return current;
    return current-previous;
  }
  static LocalDate eventDate(long wallNow,long elapsedNow,long eventElapsed,ZoneId zone){
    long age=eventElapsed>=0&&eventElapsed<=elapsedNow?(elapsedNow-eventElapsed)/1000000:0;
    return Instant.ofEpochMilli(wallNow-age).atZone(zone).toLocalDate();
  }
}
