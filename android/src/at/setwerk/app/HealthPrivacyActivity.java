package at.setwerk.app;
import android.app.*;
import android.os.Bundle;

/** Available from the system permission screen without login or network access. */
public final class HealthPrivacyActivity extends Activity {
  @Override public void onCreate(Bundle saved){
    super.onCreate(saved);
    boolean en=getSharedPreferences("setwerk",MODE_PRIVATE).getString("display-language","de").equals("en");
    new AlertDialog.Builder(this).setTitle(en?"Health Connect – steps":"Health Connect – Schritte")
      .setMessage(en?"Setwerk reads daily step totals for the last seven days from Health Connect after you grant access. These totals are saved in the step counter and calendar. Totals available in Health Connect replace manual totals for the same day; days without data stay unchanged. If you are signed in, steps are also synchronized with your Setwerk account in Firebase, like your other training data. Guest data stays on this device. Setwerk does not write to Health Connect or read other health data. You can stop synchronization in Setwerk and revoke access in Android's Health Connect settings. Previously imported steps remain until you edit them or delete your Setwerk account.":"Setwerk liest nach deiner Freigabe die täglichen Schrittsummen der letzten sieben Tage aus Health Connect und speichert sie im Schrittzähler und Kalender. Vorhandene Health-Connect-Werte ersetzen manuelle Werte am selben Tag; Tage ohne Daten bleiben unverändert. Bei angemeldetem Konto werden die Schritte wie deine anderen Trainingsdaten auch mit deinem Setwerk-Konto in Firebase synchronisiert. Gastdaten bleiben auf diesem Gerät. Setwerk schreibt keine Daten in Health Connect und liest keine anderen Gesundheitsdaten. Du kannst die Synchronisierung in Setwerk stoppen und den Zugriff in den Android-Einstellungen für Health Connect widerrufen. Bereits übernommene Schritte bleiben erhalten, bis du sie bearbeitest oder dein Setwerk-Konto löschst.")
      .setPositiveButton(en?"Close":"Schließen",(d,w)->finish()).setOnCancelListener(d->finish()).show();
  }
}
