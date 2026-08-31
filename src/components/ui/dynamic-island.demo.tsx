import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { DynamicIsland } from "@/components/ui/dynamic-island";

function DynamicIslandDemo() {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setExpanded(false), 3000);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="flex min-h-[200px] w-full items-start justify-center bg-neutral-900 p-10">
      <DynamicIsland
        expanded={expanded}
        icon={<Bell className="h-3.5 w-3.5" />}
        title="New Message"
        body="You have a new notification!"
        onClick={() => setExpanded((e) => !e)}
      />
    </div>
  );
}

export { DynamicIslandDemo };
