import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Clock } from "lucide-react";

export function PendingPlayerBanner() {
  return (
    <Alert className="border-yellow-500/50 bg-yellow-500/10 mb-6">
      <Clock className="h-5 w-5 text-yellow-500" />
      <AlertTitle className="text-yellow-500 font-semibold">Cadastro Pendente</AlertTitle>
      <AlertDescription className="text-muted-foreground">
        Seu cadastro está aguardando aprovação do administrador. Enquanto isso, você pode 
        acompanhar rodadas, classificação e estatísticas, mas não pode ser escalado em times.
      </AlertDescription>
    </Alert>
  );
}
