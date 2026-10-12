package at.setwerk.app;
import java.time.*;
public final class StepCounterStateTest {
  private static void expect(long want,long got){if(want!=got)throw new AssertionError(want+" != "+got);}
  public static void main(String[] args){
    expect(0,StepCounterState.delta(-1,1,10000,1));
    expect(150,StepCounterState.delta(10000,1,10150,1));
    expect(0,StepCounterState.delta(10150,1,10150,1));
    expect(12,StepCounterState.delta(10150,1,12,2));
    expect(8,StepCounterState.delta(100,1,8,1));
    expect(0,StepCounterState.delta(100,1,-1,1));
    long midnight=Instant.parse("2026-10-13T00:00:05Z").toEpochMilli();
    if(!StepCounterState.eventDate(midnight,20000000000L,10000000000L,ZoneId.of("UTC")).equals(LocalDate.parse("2026-10-12")))throw new AssertionError("Delayed pre-midnight event assigned to wrong day");
    if(!StepCounterState.eventDate(midnight,20000000000L,20000000000L,ZoneId.of("UTC")).equals(LocalDate.parse("2026-10-13")))throw new AssertionError("Current event assigned to wrong day");
    System.out.println("Step counter baseline, increments, repeated values and reboot/reset checks passed");
  }
}
