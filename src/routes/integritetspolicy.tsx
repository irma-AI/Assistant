import { createFileRoute } from '@tanstack/react-router'
import { Part2, Part2b, Part4 } from './-policyTables'
import { Legal, controller } from './-legal'

export const Route = createFileRoute('/integritetspolicy')({
  head: () => ({ meta: [{ title: 'Integritetspolicy – Assistant' }] }),
  component: Policy,
})

function Policy() {
  return (
    <Legal title="Integritetspolicy">
      <Part1 />
      <Part2 />
      <Part2b />
      <Part3 />
      <Part4 />
      <Part5 />
      <Part6 />
    </Legal>
  )
}

function Part1() {
  return (
    <>
      <h2>Kort version</h2>
      <ul>
        <li>
          Vi sparar ditt namn och en nyckelkrypterad avbild av ditt
          personnummer, aldrig själva numret.
        </li>
        <li>
          Du loggar in med BankID. Uppgifterna lagras på en server i Sverige.
        </li>
        <li>Vi använder bara nödvändiga kakor, så ingen kakbanner behövs.</li>
        <li>Vi säljer inga uppgifter och för inte över dem utanför EU/EES.</li>
        <li>
          Du kan när som helst begära utdrag, rättelse eller radering och klaga
          hos IMY.
        </li>
      </ul>

      <h2>1. Personuppgiftsansvarig</h2>
      <p>
        {controller} är personuppgiftsansvarig för uppgifterna om dig som har
        ett konto hos oss. För bokföringsuppgifter som din organisation lägger
        in är organisationen ansvarig och vi är personuppgiftsbiträde; se{' '}
        <a href="/personuppgiftsbitradesavtal">personuppgiftsbiträdesavtalet</a>
        .
      </p>
    </>
  )
}

function Part3() {
  return (
    <>
      <h2>3. Vilka vi delar uppgifter med</h2>
      <ul>
        <li>
          <strong>HostUp</strong> driver servern i Sverige och är vårt
          personuppgiftsbiträde.
        </li>
        <li>
          <strong>BankID:s bank</strong> får personnummer, namn, IP-adress,
          webbläsare och enhetsidentifierare vid inloggning och är själv
          personuppgiftsansvarig för sin behandling.
        </li>
        <li>
          <strong>Leverantören av säkerhetskopior</strong> får krypterade kopior
          när säkerhetskopiering startar.
        </li>
      </ul>
      <p>Vi för inte över uppgifter till länder utanför EU/EES.</p>
    </>
  )
}

function Part5() {
  return (
    <>
      <h2>5. Säkerhet</h2>
      <ul>
        <li>Uppgifterna lagras på en server hos HostUp i Sverige.</li>
        <li>All trafik är krypterad (TLS).</li>
        <li>
          Personnummer lagras inte, bara en nyckelkrypterad avbild där nyckeln
          hålls utanför databasen.
        </li>
        <li>Sessionsnycklar lagras bara som SHA-256-avbild.</li>
        <li>
          Säkerhetskopior krypteras innan de lämnar servern och lagras inom EU.
        </li>
      </ul>

      <h2>6. Dina rättigheter</h2>
      <p>
        Du har rätt att få utdrag, rättelse, radering, begränsning och
        dataportabilitet, och att invända mot behandling som bygger på
        berättigat intresse. Kontakta oss på adressen ovan. Du har också rätt
        att klaga hos Integritetsskyddsmyndigheten (IMY),{' '}
        <a href="https://www.imy.se">imy.se</a>.
      </p>
    </>
  )
}

function Part6() {
  return (
    <>
      <h2>7. Kakor och lokal lagring</h2>
      <p>
        Vi använder bara kakor som är nödvändiga för tjänsten du ber om (9 kap.
        28 § lagen om elektronisk kommunikation), därför frågar vi inte om
        samtycke.
      </p>
      <table>
        <thead>
          <tr>
            <th>Namn</th>
            <th>Syfte</th>
            <th>Livslängd</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>__Host-session</code>
            </td>
            <td>Håller din session</td>
            <td>Webb 12 timmar, app 90 dagar</td>
          </tr>
          <tr>
            <td>Inloggningskaka</td>
            <td>Kopplar en BankID-order till webbläsaren som startade den</td>
            <td>Tills inloggningen är slut</td>
          </tr>
          <tr>
            <td>
              <code>__Host-device</code>
            </td>
            <td>Enhetsidentifierare som skickas till BankID</td>
            <td>365 dagar</td>
          </tr>
        </tbody>
      </table>

      <h2>8. Ändringar</h2>
      <p>
        Vid viktiga ändringar meddelar vi dig i appen eller med meddelande innan
        de börjar gälla. Du ska inte behöva kontrollera själv om texten har
        ändrats.
      </p>
    </>
  )
}
