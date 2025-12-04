import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  first_name: z.string().trim().min(1, { message: "Nome é obrigatório" }).max(100, { message: "Nome muito longo" }),
  last_name: z.string().trim().min(1, { message: "Sobrenome é obrigatório" }).max(100, { message: "Sobrenome muito longo" }),
  birthDate: z.string().min(1, { message: "Data de nascimento é obrigatória" }),
}).refine((data) => data.email.toLowerCase() === data.emailConfirm.toLowerCase(), {
  message: "Os e-mails não coincidem",
  path: ["emailConfirm"],
});

// Função para formatar data no formato dd/mm/yyyy
const formatBirthDateInput = (value: string): string => {
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, '');
  
  // Aplica a máscara dd/mm/yyyy
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
  const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = dateStr.match(regex);
  
  if (!match) {
    return { valid: false, iso: null, error: "Data deve estar no formato dd/mm/yyyy" };
  }
  
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  
  // Validações básicas
  if (month < 1 || month > 12) {
    return { valid: false, iso: null, error: "Mês inválido" };
  }
  
  if (day < 1 || day > 31) {
    return { valid: false, iso: null, error: "Dia inválido" };
  }
  
  // Criar data e validar
  const date = new Date(year, month - 1, day);
  
  // Verificar se a data é válida (ex: 31/02 seria inválido)
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
  
  // Converter para ISO (YYYY-MM-DD)
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { valid: true, iso };
};

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [isPlayer, setIsPlayer] = useState("sim");

  useEffect(() => {
    checkUser();
  }, []);

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
    
    // Validar formato da data
    const dateResult = parseBirthDate(birthDate);
    if (!dateResult.valid) {
      toast.error(dateResult.error || "Data de nascimento inválida");
      return;
    }
    
    // Validação do schema
    const validation = signUpSchema.safeParse({ 
      email, 
      emailConfirm,
      password, 
      first_name: firstName, 
      last_name: lastName,
      birthDate
    });
    
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    try {
      setLoading(true);
      
      const fullName = `${validation.data.first_name} ${validation.data.last_name}`.trim();
      const birthIso = dateResult.iso;
      
      const { data, error } = await supabase.auth.signUp({
        email: validation.data.email,
        password: validation.data.password,
        options: {
          data: {
            name: fullName || 'Usuário',
            first_name: validation.data.first_name,
            last_name: validation.data.last_name,
            nickname: validation.data.first_name || validation.data.email,
            birth_date: birthIso,
            is_player: isPlayer === "sim",
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;
      
      if (data.user) {
        // Se for jogador, chamar Edge Function para vincular/criar player_id
        if (isPlayer === "sim") {
          console.log('[Auth] Invocando link-player para:', data.user.id);
          
          const { data: linkResult, error: linkError } = await supabase.functions.invoke('link-player', {
            body: {
              auth_user_id: data.user.id,
              email: validation.data.email,
              birth_date: birthIso,
              first_name: validation.data.first_name,
              last_name: validation.data.last_name,
            }
          });

          if (linkError) {
            console.error("[Auth] Erro ao vincular jogador:", linkError);
            toast.error("Erro ao processar cadastro de jogador. Tente novamente.");
            return;
          }

          console.log('[Auth] Link-player retornou:', linkResult);
          
          if (linkResult && linkResult.ok === false) {
            console.warn('[Auth] Link-player retornou ok: false:', linkResult.error);
            toast.success("Cadastro criado! Estamos processando seus dados.", {
              duration: 5000,
            });
          } else {
            toast.success(linkResult?.message || "Cadastro realizado com sucesso!");
          }
        } else {
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
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center mb-2">
              <img src={novoLogo} alt="Logo" className="h-32 w-auto object-contain" />
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
              {isSignUp && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nome *</Label>
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="Seu nome"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Sobrenome *</Label>
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Seu sobrenome"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="h-12"
                    />
                  </div>
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
                    <Label htmlFor="isPlayer">Você é jogador?</Label>
                    <Select value={isPlayer} onValueChange={setIsPlayer}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sim">Sim</SelectItem>
                        <SelectItem value="nao">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                {loading ? "Carregando..." : isSignUp ? "Cadastrar" : "Entrar"}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-primary hover:underline text-sm"
                >
                  {isSignUp ? "Já tem conta? Entrar" : "Criar conta"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
