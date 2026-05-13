/**
 * PROJ-17: Serverseitige PDF-Generierung der Zuwendungsbestätigung.
 *
 * Folgt dem amtlichen BMF-Muster „Bestätigung über Geldzuwendungen"
 * (Muster 1 – Geldspende an inländische Körperschaft, BMF-Schreiben
 * vom 07.11.2013). Wortlaut und Reihenfolge der Pflichthinweise dürfen
 * laut § 50 EStDV nicht verändert werden.
 *
 * Layout ist bewusst kompakt gewählt, damit die gesamte Quittung auf
 * eine DIN-A4-Seite passt.
 */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer"
import { betragInWorten } from "@/lib/betrag-in-worten"
import type { VereinSnapshot } from "@/lib/types"

export interface SpendenquittungPdfData {
  quittungNummer: string
  spendeDatum: string // YYYY-MM-DD
  quittungDatum: string // YYYY-MM-DD
  betrag: number
  zweck: string
  spender: {
    name: string
    strasse?: string | null
    plz?: string | null
    ort?: string | null
  }
  /** Snapshot der Vereinsdaten – kein OrganisationSettings, damit Quittungen
   *  unabhängig von späteren Settings-Änderungen rendern können. */
  verein: VereinSnapshot
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 50,
    fontSize: 10,
    fontFamily: "Helvetica",
    lineHeight: 1.3,
  },
  header: {
    marginBottom: 10,
  },
  vereinName: {
    fontSize: 11,
    fontWeight: "bold",
  },
  vereinAdresse: {
    fontSize: 10,
  },
  steuerInfo: {
    fontSize: 9,
    marginTop: 2,
    color: "#444444",
  },
  title: {
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9.5,
    textAlign: "center",
    marginBottom: 10,
  },
  quittungsNr: {
    fontSize: 9,
    color: "#444",
    marginBottom: 8,
  },
  spenderBlock: {
    marginTop: 8,
    marginBottom: 10,
  },
  spenderName: {
    fontSize: 11,
    fontWeight: "bold",
  },
  betragRow: {
    flexDirection: "row",
    marginTop: 8,
    marginBottom: 3,
  },
  betragLabel: {
    width: 140,
    fontWeight: "bold",
  },
  betragValue: {
    fontWeight: "bold",
  },
  textBlock: {
    marginTop: 8,
    textAlign: "justify",
  },
  unterschriftRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 22,
  },
  unterschriftBox: {
    width: "45%",
  },
  hinweisBox: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#000000",
    paddingTop: 8,
    fontSize: 8,
    color: "#222222",
    textAlign: "justify",
  },
})

/**
 * Formatiert ein ISO-Datum (YYYY-MM-DD) als deutsches Datum (DD.MM.YYYY).
 */
function formatDateDe(isoDate: string): string {
  if (!isoDate) return ""
  const [yyyy, mm, dd] = isoDate.split("-")
  if (!yyyy || !mm || !dd) return isoDate
  return `${dd}.${mm}.${yyyy}`
}

function formatBetrag(betrag: number): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(betrag)
}

/**
 * Liefert den Freistellungs-Pflichthinweis nach BMF-Muster.
 */
function freistellungsHinweis(verein: VereinSnapshot): string {
  const datum = formatDateDe(verein.freistellungsbescheid_datum)
  return (
    `Wir sind gemäß Vereinszweck und gemäß des Freistellungsbescheids ` +
    `des Finanzamts ${verein.finanzamt}, ` +
    `Steuer-Nr. ${verein.steuernummer}, vom ${datum} für den letzten ` +
    `Veranlagungszeitraum ${verein.letzter_veranlagungszeitraum} nach ` +
    `§ 5 Abs. 1 Nr. 9 des Körperschaftsteuergesetzes von der ` +
    `Körperschaftsteuer und nach § 3 Nr. 6 des Gewerbesteuergesetzes von ` +
    `der Gewerbesteuer befreit.`
  )
}

const HAFTUNGS_HINWEIS =
  "Wer vorsätzlich oder grob fahrlässig eine unrichtige Zuwendungsbestätigung " +
  "erstellt oder veranlasst, dass Zuwendungen nicht zu den in der " +
  "Zuwendungsbestätigung angegebenen steuerbegünstigten Zwecken verwendet " +
  "werden, haftet für die entgangene Steuer (§ 10b Abs. 4 EStG, § 9 Abs. 3 " +
  "KStG, § 9 Nr. 5 GewStG)."

const ZEHN_JAHRES_HINWEIS =
  "Diese Bestätigung wird nicht als Nachweis für die steuerliche Berücksichtigung " +
  "der Zuwendung anerkannt, wenn das Datum der Zahlung weiter als zehn Jahre " +
  "zurückliegt (§ 63 Abs. 5 AO)."

/**
 * Erzeugt das PDF als Buffer (für Storage-Upload und E-Mail-Anhang).
 */
export async function rendereSpendenquittungPdf(
  data: SpendenquittungPdfData
): Promise<Buffer> {
  const doc = (
    <Document
      title={`Zuwendungsbestätigung ${data.quittungNummer}`}
      author={data.verein.verein_name}
      subject="Zuwendungsbestätigung nach amtlichem BMF-Muster"
    >
      <Page size="A4" style={styles.page}>
        {/* Kopf: Aussteller */}
        <View style={styles.header}>
          <Text style={styles.vereinName}>{data.verein.verein_name}</Text>
          <Text style={styles.vereinAdresse}>{data.verein.adresse_zeile1}</Text>
          {data.verein.adresse_zeile2 ? (
            <Text style={styles.vereinAdresse}>
              {data.verein.adresse_zeile2}
            </Text>
          ) : null}
          <Text style={styles.vereinAdresse}>
            {data.verein.plz} {data.verein.ort}
          </Text>
          <Text style={styles.steuerInfo}>
            Steuer-Nr.: {data.verein.steuernummer} · Finanzamt{" "}
            {data.verein.finanzamt}
          </Text>
        </View>

        {/* Titel */}
        <Text style={styles.title}>Bestätigung über Geldzuwendungen</Text>
        <Text style={styles.subtitle}>
          im Sinne des § 10b des Einkommensteuergesetzes an eine der in
          § 5 Abs. 1 Nr. 9 des Körperschaftsteuergesetzes bezeichneten
          Körperschaften, Personenvereinigungen oder Vermögensmassen
        </Text>

        {/* Quittungsnummer */}
        <Text style={styles.quittungsNr}>
          Quittungs-Nr.: {data.quittungNummer}
        </Text>

        {/* Spender */}
        <View style={styles.spenderBlock}>
          <Text style={{ marginBottom: 3 }}>
            Name und Anschrift des Zuwendenden:
          </Text>
          <Text style={styles.spenderName}>{data.spender.name}</Text>
          {data.spender.strasse ? <Text>{data.spender.strasse}</Text> : null}
          {data.spender.plz || data.spender.ort ? (
            <Text>
              {data.spender.plz} {data.spender.ort}
            </Text>
          ) : null}
        </View>

        {/* Betrag */}
        <View style={styles.betragRow}>
          <Text style={styles.betragLabel}>Betrag der Zuwendung:</Text>
          <Text style={styles.betragValue}>
            {formatBetrag(data.betrag)} EUR
          </Text>
        </View>
        <View style={{ flexDirection: "row", marginBottom: 3 }}>
          <Text style={{ width: 140 }}>– in Worten:</Text>
          <Text>{betragInWorten(data.betrag)}</Text>
        </View>
        <View style={{ flexDirection: "row", marginBottom: 3 }}>
          <Text style={{ width: 140 }}>Tag der Zuwendung:</Text>
          <Text>{formatDateDe(data.spendeDatum)}</Text>
        </View>

        {/* Verzicht-Hinweis */}
        <Text style={styles.textBlock}>
          Es handelt sich nicht um den Verzicht auf Erstattung von
          Aufwendungen.
        </Text>

        {/* Freistellungs-Bescheinigung */}
        <Text style={styles.textBlock}>
          {freistellungsHinweis(data.verein)}
        </Text>

        {/* Verwendungszweck */}
        <Text style={styles.textBlock}>
          Es wird bestätigt, dass die Zuwendung nur zur Förderung des
          Vereins im Sinne des Vereinszweckes verwendet wird.
        </Text>

        {/* Unterschrift – elektronisch ausgestellt, daher „gez." statt Signatur */}
        <View style={styles.unterschriftRow}>
          <View style={styles.unterschriftBox}>
            <Text>
              {data.verein.ort}, den {formatDateDe(data.quittungDatum)}
            </Text>
          </View>
          <View style={styles.unterschriftBox}>
            <Text>gez. {data.verein.unterzeichner_name}</Text>
            <Text style={{ fontSize: 8, color: "#444", marginTop: 2 }}>
              (elektronisch ausgestellt, gültig ohne Unterschrift)
            </Text>
          </View>
        </View>

        {/* Pflichthinweise */}
        <View style={styles.hinweisBox}>
          <Text style={{ fontWeight: "bold", marginBottom: 3 }}>Hinweis:</Text>
          <Text>{HAFTUNGS_HINWEIS}</Text>
          <Text style={{ marginTop: 4 }}>{ZEHN_JAHRES_HINWEIS}</Text>
        </View>
      </Page>
    </Document>
  )

  return renderToBuffer(doc)
}
