export default function SelectionRadio({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <input
      type="radio"
      name={name}
      aria-label={label}
      checked={checked}
      onClick={(event) => event.stopPropagation()}
      onChange={onChange}
    />
  );
}
