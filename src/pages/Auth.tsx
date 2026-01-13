import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import novoLogo from "@/assets/novo-logo.png";
import { z } from "zod";
import { BouncingBalls } from "@/components/ui/bouncing-balls";
import Footer from "@/components/Footer";
import { getUserFriendlyError } from "@/lib/errorHandler";

const loginSchema = z.object({
  email: z.string().trim().email({ message: "E-mail inválido" }).max(255, { message: "E-mail muito longo" }),
  password: z.string().min(6, { message: "Senha deve ter no mínimo 6 caracteres" }),
});

const signUpSchema = z.object({
  email: z.string().trim().email({ message: "E-mail inválido" }).max(255, { message: "E-mail muito longo" }),
  emailConfirm: z.string().trim().email({ message: "E-mail de confirmação inválido" }),
  password: z.string().min(6, { message: "Senha deve ter no mínimo 6 caracteres" }),
  fullName: z.string().trim().min(2, { message: "Nome é obrigatório" }).max(100, { message: "Nome muito longo" }),
  birthDate: z.string().optional(),
}).refine((data) => data.email.toLowerCase() === data.emailConfirm.toLowerCase(), {
  message: "Os e-mails não coincidem",
  path: ["emailConfirm"],
});

// Função para formatar data no formato dd/mm/yyyy
const formatBirthDateInput = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) {
    return numbers;
  } else if (numbers.length <= 4) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  } else {
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  }
};

// Função para validar e converter data dd/mm/yyyy para ISO
const parseBirthDate = (dateStr: string): { valid: boolean; iso: string | null; error?: string } => {
  if (!dateStr || dateStr.trim() === '') {
    return { valid: false, iso: null, error: "Data de nascimento é obrigatória para jogadores" };
  }

  const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = dateStr.match(regex);

  if (!match) {
    return { valid: false, iso: null, error: "Data deve estar no formato dd/mm/yyyy" };
  }

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (month < 1 || month > 12) {
    return { valid: false, iso: null, error: "Mês inválido" };
  }

  if (day < 1 || day > 31) {
    return { valid: false, iso: null, error: "Dia inválido" };
  }

  const date = new Date(year, month - 1, day);

  if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
    return { valid: false, iso: null, error: "Data inválida" };
  }

  const today = new Date();
  if (date > today) {
    return { valid: false, iso: null, error: "Data de nascimento não pode ser no futuro" };
  }

  if (year < 1900) {
    return { valid: false, iso: null, error: "Data de nascimento inválida" };
  }

  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { valid: true, iso };
};

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [accountType, setAccountType] = useState<"player" | "observer">("player");
  const [claimToken, setClaimToken] = useState("");

  useEffect(() => {
    checkUser();
    // Preencher token se vier na URL
    const tokenFromUrl = searchParams.get("token");
    if (tokenFromUrl) {
      setClaimToken(tokenFromUrl);
      setIsSignUp(true);
      setAccountType("player");
    }
  }, [searchParams]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      navigate("/");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: validation.data.email,
        password: validation.data.password,
      });

      if (error) throw error;

      if (data.user) {
        toast.success("Login realizado com sucesso!");
        navigate("/");
      }
    } catch (error: any) {
      toast.error(getUserFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    // Para jogadores, validar data de nascimento
    let birthIso: string | null = null;
    if (accountType === "player") {
      const dateResult = parseBirthDate(birthDate);
      if (!dateResult.valid) {
        toast.error(dateResult.error || "Data de nascimento inválida");
        return;
      }
      birthIso = dateResult.iso;
    }

    // Separar nome completo em first_name e last_name
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Validação do schema
    const validation = signUpSchema.safeParse({
      email,
      emailConfirm,
      password,
      fullName,
      birthDate: accountType === "player" ? birthDate : undefined,
    });

    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    try {
      setLoading(true);

      const isPlayer = accountType === "player";

      const { data, error } = await supabase.auth.signUp({
        email: validation.data.email,
        password: validation.data.password,
        options: {
          data: {
            name: fullName || 'Usuário',
            first_name: firstName,
            last_name: lastName,
            nickname: firstName || validation.data.email,
            birth_date: birthIso,
            is_player: isPlayer,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      if (data.user) {
        // Se jogador COM token, tentar reivindicar perfil via RPC
        if (isPlayer && claimToken.trim()) {
          console.log('[Auth] Tentando reivindicar perfil com token:', claimToken);

          const { data: claimResult, error: claimError } = await supabase.rpc('claim_profile_with_token', {
            p_token: claimToken.trim(),
            p_user_id: data.user.id,
          });

          if (claimError) {
            console.error("[Auth] Erro ao reivindicar token:", claimError);
            // Continua para link-player como fallback
          } else {
            const result = claimResult as { success: boolean; message?: string; error?: string };
            if (result.success) {
              toast.success(result.message || "Perfil vinculado com sucesso!");
              navigate("/");
              return;
            } else {
              toast.error(result.error || "Token inválido");
              // Continua para link-player como fallback
            }
          }
        }

        // Se for jogador (sem token ou token falhou), chamar Edge Function
        if (isPlayer) {
          console.log('[Auth] Invocando link-player para:', data.user.id);

          const { data: linkResult, error: linkError } = await supabase.functions.invoke('link-player', {
            body: {
              auth_user_id: data.user.id,
              email: validation.data.email,
              birth_date: birthIso,
              first_name: firstName,
              last_name: lastName,
            }
          });

          if (linkError) {
            console.error("[Auth] Erro ao vincular jogador:", linkError);
            toast.warning("Cadastro criado! Aguardando processamento.", { duration: 5000 });
          } else {
            console.log('[Auth] Link-player retornou:', linkResult);

            if (linkResult?.linked) {
              toast.success(linkResult.message || "Cadastro vinculado com sucesso!");
            } else {
              toast.success(linkResult?.message || "Cadastro realizado! Aguarde aprovação do administrador.");
            }
          }
        } else {
          // Não-jogador: já aprovado automaticamente
          toast.success("Conta criada com sucesso!");
        }

        navigate("/");
      }
    } catch (error: any) {
      console.error("Erro ao criar conta:", error);
      toast.error(error.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatBirthDateInput(e.target.value);
    setBirthDate(formatted);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <BouncingBalls
          numBalls={100}
          backgroundColor="hsl(0, 0%, 0%)"
          colors={["hsl(330, 100%, 60%)", "hsl(330, 100%, 70%)", "hsl(330, 100%, 50%)"]}
          minRadius={1}
          maxRadius={3}
          speed={0.3}
          interactive={true}
          followMouse={false}
        />
      </div>
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md card-glow bg-card border-border">
          <CardHeader className="text-center space-y-4 relative">
            {/* Botão Voltar */}
            <button
              onClick={() => navigate("/")}
              className="absolute left-4 top-4 p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex justify-center mb-2">
              <img src={novoLogo} alt="Logo" className="h-32 w-auto object-contain" />
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
              {isSignUp && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome completo *</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Seu nome completo"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="h-12"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Tipo de conta *</Label>
                    <RadioGroup
                      value={accountType}
                      onValueChange={(value) => setAccountType(value as "player" | "observer")}
                      className="flex flex-col space-y-2"
                    >
                      <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/10 cursor-pointer">
                        <RadioGroupItem value="player" id="player" />
                        <Label htmlFor="player" className="cursor-pointer flex-1">
                          <span className="font-medium">Sou jogador</span>
                          <p className="text-xs text-muted-foreground">Quero participar dos times e partidas</p>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/10 cursor-pointer">
                        <RadioGroupItem value="observer" id="observer" />
                        <Label htmlFor="observer" className="cursor-pointer flex-1">
                          <span className="font-medium">Não sou jogador</span>
                          <p className="text-xs text-muted-foreground">Apenas acompanhar rodadas e estatísticas</p>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {accountType === "player" && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="birthDate">Data de Nascimento *</Label>
                        <Input
                          id="birthDate"
                          type="text"
                          placeholder="dd/mm/yyyy"
                          value={birthDate}
                          onChange={handleBirthDateChange}
                          maxLength={10}
                          required
                          className="h-12"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="claimToken">Token do jogador (opcional)</Label>
                        <Input
                          id="claimToken"
                          type="text"
                          placeholder="Ex: ABC12345"
                          value={claimToken}
                          onChange={(e) => setClaimToken(e.target.value.toUpperCase())}
                          maxLength={8}
                          className="h-12 uppercase"
                        />
                        <p className="text-xs text-muted-foreground">
                          Se você recebeu um código do administrador, insira aqui para vincular seu histórico.
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12"
                />
              </div>
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="emailConfirm">Confirmar E-mail *</Label>
                  <Input
                    id="emailConfirm"
                    type="email"
                    placeholder="Digite novamente seu e-mail"
                    value={emailConfirm}
                    onChange={(e) => setEmailConfirm(e.target.value)}
                    required
                    className="h-12"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">Senha *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-12"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-secondary text-primary-foreground font-bold h-12"
                size="lg"
              >
                {loading ? "Carregando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
