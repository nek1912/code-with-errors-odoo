import { useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { DepartmentsTab } from "@/components/org/DepartmentsTab";
import { CategoriesTab } from "@/components/org/CategoriesTab";
import { EmployeesTab } from "@/components/org/EmployeesTab";
import { EntityModal } from "@/components/org/EntityModal";

type ModalState =
  | { open: false }
  | { open: true; entityType: "department" | "category" | "role"; editData?: any };

export default function OrganizationSetup() {
  const [activeTab, setActiveTab] = useState("departments");
  const [modal, setModal] = useState<ModalState>({ open: false });

  const openAdd = () => {
    if (activeTab === "departments") setModal({ open: true, entityType: "department" });
    else if (activeTab === "categories") setModal({ open: true, entityType: "category" });
  };

  return (
    <div className="flex min-h-screen bg-neutral-950">
      <Sidebar />
      <main className="ml-60 flex-1 p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Organization Setup
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                Manage departments, asset categories, and employee roles
              </p>
            </div>
            {(activeTab === "departments" || activeTab === "categories") && (
              <Button onClick={openAdd} className="gap-2">
                <Plus className="h-4 w-4" />
                Add {activeTab === "departments" ? "Department" : "Category"}
              </Button>
            )}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="departments" onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="departments">Departments</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="employees">Employees</TabsTrigger>
            </TabsList>

            <TabsContent value="departments">
              <DepartmentsTab
                onEdit={(d) => setModal({ open: true, entityType: "department", editData: d })}
              />
            </TabsContent>

            <TabsContent value="categories">
              <CategoriesTab
                onEdit={(c) => setModal({ open: true, entityType: "category", editData: c })}
              />
            </TabsContent>

            <TabsContent value="employees">
              <EmployeesTab
                onEditRole={(e) => setModal({ open: true, entityType: "role", editData: e })}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <EntityModal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        entityType={modal.open ? modal.entityType : "department"}
        editData={modal.open ? modal.editData : undefined}
      />
    </div>
  );
}
