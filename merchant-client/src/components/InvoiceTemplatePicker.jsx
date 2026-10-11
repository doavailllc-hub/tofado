import { CheckCircle2 } from "lucide-react";
import { INVOICE_COLORS, INVOICE_TEMPLATES } from "../services/invoicePreferences";

export default function InvoiceTemplatePicker({ value, onChange, color, onColorChange }) {
  return (
    <section className="invoice-template-picker no-print" aria-labelledby="invoice-template-title">
      <div className="invoice-template-heading">
        <div>
          <strong id="invoice-template-title">Invoice style</strong>
          <span>Choose how the printed or saved PDF will look</span>
        </div>
      </div>
      <div className="invoice-template-options" role="radiogroup" aria-labelledby="invoice-template-title">
        {INVOICE_TEMPLATES.map((template) => {
          const selected = template.id === value;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              className={`invoice-template-option${selected ? " selected" : ""}`}
              style={{ "--template-accent": template.accent, "--template-preview": template.preview }}
              key={template.id}
              onClick={() => onChange(template.id)}
            >
              <span className="invoice-template-swatch"><i /><i /><i /></span>
              <span><strong>{template.name}</strong><small>{template.description}</small></span>
              {selected && <CheckCircle2 size={18} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="invoice-color-row">
        <div><strong>Brand color</strong><span>Applied to the preview and exported invoice</span></div>
        <div className="invoice-color-options" role="radiogroup" aria-label="Invoice brand color">
          {INVOICE_COLORS.map((option) => (
            <button key={option.id} type="button" role="radio" aria-checked={color === option.value}
              aria-label={option.name} title={option.name}
              className={color === option.value ? "selected" : ""}
              style={{ backgroundColor: option.value }} onClick={() => onColorChange(option.value)} />
          ))}
          <label className="invoice-custom-color" title="Custom color">
            <input type="color" value={color} onChange={(event) => onColorChange(event.target.value)} aria-label="Custom invoice color" />
            <span>Custom</span>
          </label>
        </div>
      </div>
    </section>
  );
}
