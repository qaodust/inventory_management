import { NewManufacturerForm } from "./NewManufacturerForm";

export default function NewManufacturerPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Add Manufacturer</h1>
      <NewManufacturerForm />
    </div>
  );
}
