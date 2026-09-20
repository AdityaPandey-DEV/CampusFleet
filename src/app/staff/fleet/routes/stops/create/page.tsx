import StopsManager from "@/components/staff/routes/stops/StopsManager";

export default function CreateStopPage() {
  return (
    <div className="w-full h-full pb-12">
      <StopsManager mode="create" />
    </div>
  );
}
