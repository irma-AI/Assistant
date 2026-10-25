import { createFileRoute } from '@tanstack/react-router'
import { Legal, controller } from './-legal'

export const Route = createFileRoute('/villkor')({
  head: () => ({ meta: [{ title: 'Villkor – Assistant' }] }),
  component: Terms,
})

function Terms() {
  return (
    <Legal title="Villkor">
      <p>
        Villkoren gäller mellan {controller} (”vi”) och den organisation som
        använder Assistant (”kunden”). Tjänsten riktar sig till företag och
        andra organisationer, inte till konsumenter.
      </p>
      <h2>1. Tjänsten</h2>
      <p>
        Assistant är en bokföringstjänst som kunden når via webben och appen.
        Kunden loggar in med BankID.
      </p>
      <h2>2. Konto och inloggning</h2>
      <p>
        Den som loggar in svarar för att den egna BankID-inloggningen inte
        lämnas ut. Kunden svarar för vilka personer som får använda tjänsten.
      </p>
      <h2>3. Kundens uppgifter</h2>
      <p>
        Bokföringsuppgifterna tillhör kunden. Vi behandlar dem enligt{' '}
        <a href="/personuppgiftsbitradesavtal">personuppgiftsbiträdesavtalet</a>
        . Kunden ansvarar för att uppgifterna är riktiga och att bokföringen
        uppfyller bokföringslagen.
      </p>
      <h2>4. Rimlig användning</h2>
      <p>
        Tjänsten får inte användas för olagliga ändamål eller på ett sätt som
        stör driften eller andra kunder.
      </p>
      <h2>5. Tillgänglighet och ansvar</h2>
      <p>
        Vi arbetar för att tjänsten ska fungera, men garanterar ingen oavbruten
        drift. Vårt ansvar är begränsat till direkt skada och till högst det
        kunden har betalat under de senaste tolv månaderna, utom vid uppsåt
        eller grov vårdslöshet.
      </p>
      <h2>6. Avslut</h2>
      <p>
        Kunden kan avsluta när som helst. Före radering kan kunden få en
        fullständig export, eftersom kunden måste bevara sin
        räkenskapsinformation enligt 7 kap. 2 § bokföringslagen.
      </p>
      <h2>7. Ändringar av villkoren</h2>
      <p>
        Vi meddelar kunden i appen eller med meddelande innan väsentliga
        ändringar börjar gälla.
      </p>
      <h2>8. Tillämplig lag</h2>
      <p>Svensk lag gäller och tvister prövas av svensk allmän domstol.</p>
    </Legal>
  )
}
