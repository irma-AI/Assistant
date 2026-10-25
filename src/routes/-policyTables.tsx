export function Part2() {
  return (
    <>
      <h2>
        2. Vilka uppgifter vi behandlar, varför och på vilken rättslig grund
      </h2>
      <table>
        <thead>
          <tr>
            <th>Behandling</th>
            <th>Ändamål</th>
            <th>Uppgifter</th>
            <th>Rättslig grund</th>
            <th>Mottagare</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Användare</td>
            <td>Identifiera kontoinnehavaren</td>
            <td>
              Namn, nyckelkrypterad avbild (HMAC) av personnumret, skapad tid
            </td>
            <td>Avtal (art. 6.1 b)</td>
            <td>HostUp</td>
          </tr>
          <tr>
            <td>Sessioner</td>
            <td>Hålla dig inloggad</td>
            <td>
              Avbild av sessionsnyckeln, typ, skapad, utgår, senast använd,
              avslutad
            </td>
            <td>Avtal</td>
            <td>HostUp</td>
          </tr>
          <tr>
            <td>BankID-inloggning</td>
            <td>Verifiera dig och förhindra missbruk</td>
            <td>
              IP-adress, webbläsare (user agent) och enhetsidentifierare som
              skickas till BankID; order; utfall; tid
            </td>
            <td>
              Avtal för inloggningen; berättigat intresse (art. 6.1 f) för
              missbruksskydd
            </td>
            <td>BankID:s bank (egen personuppgiftsansvarig), HostUp</td>
          </tr>
          <tr>
            <td>Drift- och containerloggar</td>
            <td>Driva tjänsten, hitta fel och attacker</td>
            <td>Sökväg, IP-adress, webbläsare, status, tid</td>
            <td>Berättigat intresse</td>
            <td>HostUp</td>
          </tr>
          <PlannedRows />
        </tbody>
      </table>
    </>
  )
}

export function Part2b() {
  return (
    <>
      <p>
        Berättigat intresse betyder här att skydda tjänsten och dess användare.
        Vi har bedömt att det intresset väger tyngre än risken för dig, eftersom
        uppgifterna är få och sparas kort.
      </p>
      <p>
        Personnummer används bara för att du ska kunna identifieras entydigt med
        BankID, vilket är klart motiverat enligt 3 kap. 10 § dataskyddslagen. Vi
        lagrar aldrig numret, bara en nyckelkrypterad avbild.
      </p>
      <p>
        Uppgifterna behövs för att du ska kunna logga in. Lämnar du dem inte kan
        vi inte ge dig ett konto. Vi fattar inga automatiserade beslut som får
        rättsliga följder för dig.
      </p>
    </>
  )
}

export function Part4() {
  return (
    <>
      <h2>4. Hur länge vi sparar uppgifterna</h2>
      <table>
        <thead>
          <tr>
            <th>Uppgift</th>
            <th>Lagringstid</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Användare</td>
            <td>Tills kontot raderas</td>
          </tr>
          <tr>
            <td>Sessioner</td>
            <td>
              Webb 12 timmar, app 90 dagar; avslutade sessioner raderas efter 30
              dagar
            </td>
          </tr>
          <tr>
            <td>BankID-inloggning</td>
            <td>
              Raderas när ordern slutförs, misslyckas eller avbryts, senast inom
              en timme
            </td>
          </tr>
          <tr>
            <td>Drift- och containerloggar</td>
            <td>14 dagar</td>
          </tr>
          <tr>
            <td>Demokonton (kommer)</td>
            <td>Sessioner som ovan; demodata återställs regelbundet</td>
          </tr>
          <tr>
            <td>Radering av konto (kommer)</td>
            <td>12 månader, utan identitetsuppgifter</td>
          </tr>
          <tr>
            <td>Säkerhetskopior (kommer)</td>
            <td>
              30 dagar; ett raderat konto finns kvar i kopior tills de går ut
            </td>
          </tr>
          <tr>
            <td>Granskningslogg (kommer)</td>
            <td>Bestäms när funktionen byggs</td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

function PlannedRows() {
  return (
    <>
      <tr>
        <td>Demokonton (kommer)</td>
        <td>Låta granskare i appbutiker prova appen</td>
        <td>Påhittat namn, inget personnummer</td>
        <td>Berättigat intresse</td>
        <td>HostUp</td>
      </tr>
      <tr>
        <td>Radering av konto (kommer)</td>
        <td>Uppfylla din rätt till radering</td>
        <td>Begäran och tidpunkt</td>
        <td>Rättslig förpliktelse (art. 6.1 c)</td>
        <td>HostUp</td>
      </tr>
      <tr>
        <td>Säkerhetskopior (kommer)</td>
        <td>Kunna återställa efter förlust</td>
        <td>Kopior av ovanstående</td>
        <td>Berättigat intresse</td>
        <td>Leverantör av säkerhetskopior (väljs; endast EU), HostUp</td>
      </tr>
      <tr>
        <td>Granskningslogg (kommer)</td>
        <td>Visa vem som loggat in, exporterat eller administrerat</td>
        <td>Användare, händelse, tid, IP-adress</td>
        <td>
          Berättigat intresse; rättslig förpliktelse där en regel kräver det
        </td>
        <td>HostUp</td>
      </tr>
    </>
  )
}
