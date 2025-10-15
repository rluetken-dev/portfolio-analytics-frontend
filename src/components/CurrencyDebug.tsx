import { useCurrency } from "../hooks/useCurrency";
import type { CurrencyCode } from "../types/currency";

export default function CurrencyDebug() {
  const { currency, setCurrency, rates, formatMoney } = useCurrency();

  return (
    <div
      style={{
        border: "1px solid #333",
        borderRadius: 10,
        padding: 12,
        marginTop: 12,
        fontSize: 14,
      }}
    >
      <h3 style={{ marginBottom: 8 }}>💱 Currency Debug</h3>
      <div>
        Current currency: <strong>{currency}</strong>
      </div>
      <div style={{ marginTop: 8 }}>
        <label htmlFor="currency">Change currency: </label>
        <select
          id="currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="CHF">CHF</option>
          <option value="GBP">GBP</option>
          <option value="JPY">JPY</option>
        </select>
      </div>

      <div style={{ marginTop: 12 }}>
        <strong>Example conversions:</strong>
        <ul>
          <li>100 USD → {formatMoney(100)}</li>
          <li>100 EUR → {formatMoney(100, "EUR")}</li>
          <li>100 CHF → {formatMoney(100, "CHF")}</li>
          <li>100 GBP → {formatMoney(100, "GBP")}</li>
          <li>100 JPY → {formatMoney(100, "JPY")}</li>
        </ul>
      </div>

      <div style={{ marginTop: 12 }}>
        <strong>Rates snapshot:</strong>
        <pre style={{ fontSize: 12, background: "#111", padding: 8 }}>
          {JSON.stringify(rates, null, 2)}
        </pre>
      </div>
    </div>
  );
}
