import { createFileRoute } from '@tanstack/react-router'
import { Legal, controller } from './-legal'

export const Route = createFileRoute('/personuppgiftsbitradesavtal')({
  head: () => ({
    meta: [{ title: 'Personuppgiftsbiträdesavtal – Redo' }],
  }),
  component: Dpa,
})

function Dpa() {
  return (
    <Legal title="Personuppgiftsbiträdesavtal">
      <Part1 />
      <Part2 />
    </Legal>
  )
}

function Part1() {
  return (
    <>
      <p>
        Avtalet gäller mellan kunden, som är personuppgiftsansvarig, och{' '}
        {controller}, som är personuppgiftsbiträde (art. 28
        dataskyddsförordningen). Det ingår i <a href="/villkor">villkoren</a>.
      </p>
      <h2>1. Behandlingen</h2>
      <table>
        <tbody>
          <tr>
            <th>Föremål</th>
            <td>Bokföringstjänsten Assistant</td>
          </tr>
          <tr>
            <th>Varaktighet</th>
            <td>
              Så länge kunden använder tjänsten, samt tiden för export och
              radering enligt punkt 9
            </td>
          </tr>
          <tr>
            <th>Art och ändamål</th>
            <td>
              Lagring och bearbetning för att tillhandahålla bokföringstjänsten
            </td>
          </tr>
          <tr>
            <th>Typer av uppgifter</th>
            <td>
              Verifikationer, fakturor, motparters namn och kontaktuppgifter,
              belopp
            </td>
          </tr>
          <tr>
            <th>Registrerade</th>
            <td>Kundens personal, kunder och leverantörer</td>
          </tr>
        </tbody>
      </table>
      <h2>2. Instruktioner</h2>
      <p>
        Vi behandlar uppgifterna bara på kundens dokumenterade instruktioner,
        som är detta avtal och kundens användning av tjänsten. Vi underrättar
        kunden om vi anser att en instruktion strider mot dataskyddsregler.
      </p>
      <h2>3. Sekretess</h2>
      <p>Alla som behandlar uppgifterna hos oss är bundna av tystnadsplikt.</p>
      <h2>4. Säkerhet</h2>
      <p>
        Vi vidtar lämpliga tekniska och organisatoriska åtgärder (art. 32):
        lagring i Sverige, krypterad trafik, uppgifter hållna isär per
        organisation, krypterade säkerhetskopior och begränsad åtkomst till
        servern. Se <a href="/integritetspolicy">integritetspolicyn</a>.
      </p>
    </>
  )
}

function Part2() {
  return (
    <>
      <h2>5. Underbiträden</h2>
      <p>
        Kunden ger ett allmänt godkännande av underbiträdena HostUp (server,
        Sverige) och leverantören av säkerhetskopior (endast EU). Vi meddelar
        kunden innan vi lägger till eller byter underbiträde, och kunden kan
        invända. Vi lägger samma skyldigheter på underbiträdet som i detta
        avtal.
      </p>
      <h2>6. Överföring till tredjeland</h2>
      <p>Vi överför inte uppgifter utanför EU/EES.</p>
      <h2>7. Hjälp med de registrerades rättigheter</h2>
      <p>
        Vi hjälper kunden att svara på begäranden om de registrerades
        rättigheter.
      </p>
      <h2>8. Hjälp med art. 32–36</h2>
      <p>
        Vi hjälper kunden med säkerhet, anmälan av personuppgiftsincidenter,
        konsekvensbedömning och förhandssamråd. Vi underrättar kunden utan
        onödigt dröjsmål efter att ha upptäckt en incident.
      </p>
      <h2>9. Avslut</h2>
      <p>
        När avtalet upphör lämnar vi kunden en fullständig export av uppgifterna
        och raderar därefter alla kopior, om inte lag kräver att vi sparar dem.
        Exporten behövs eftersom kunden måste bevara sin räkenskapsinformation
        enligt 7 kap. 2 § bokföringslagen. Säkerhetskopior raderas när de går
        ut.
      </p>
      <h2>10. Granskning</h2>
      <p>
        Vi ger kunden den information som behövs för att visa att art. 28 följs,
        och tillåter granskningar, även av ombud som kunden utser.
      </p>
    </>
  )
}
