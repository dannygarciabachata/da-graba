import { CoverArtDesigner } from "@/components/CoverArtDesigner";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export default function CoverDesignerPage() {
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleSave = (dataUrl: string) => {
    const link = document.createElement("a");
    link.download = "cover-art.png";
    link.href = dataUrl;
    link.click();
    toast({ description: t('coverDesigner.downloaded') });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6" data-testid="page-cover-designer">
      <div className="max-w-5xl mx-auto">
        <CoverArtDesigner onSave={handleSave} />
      </div>
    </div>
  );
}