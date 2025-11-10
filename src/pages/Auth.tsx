import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import novoLogo from "@/assets/novo-logo.png";
import { z } from "zod";
import { BouncingBalls } from "@/components/ui/bouncing-balls";
import Footer from "@/components/Footer";

const loginSchema = z.object({
  email: z.string().trim().email({ message: "E-mail inválido" }).max(255, { message: "E-mail muito longo" }),
  password: z.string().min(6, { message: "Senha deve ter no mínimo 6 caracteres" }),
});

const signUpSchema = z.object({
  email: z.string().trim().email({ message: "E-mail inválido" }).max(255, { message: "E-mail muito longo" }),
  password: z.string().min(6, { message: "Senha deve ter no mínimo 6 caracteres" }),
  first_name: z.string().trim().min(1, { message: "Primeiro nome é obrigatório" }).max(100, { message: "Nome muito longo" }),
  last_name: z.string().trim().min(1, { message: "Sobrenome é obrigatório" }).max(100, { message: "Sobrenome muito longo" }),
  birthDate: z.string().optional(),
});

interface NewPlayer {
  level: string;
  position: string;
}

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [isPlayer, setIsPlayer] = useState("nao");
  const [newPlayer, setNewPlayer] = useState<NewPlayer>({
    level: "",
    position: "",
  });

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
    
    // Validação de entrada
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
      toast.error(error.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica de entrada
    const validation = signUpSchema.safeParse({ 
      email, 
      password, 
      first_name: firstName, 
      last_name: lastName,
      birthDate: isPlayer === "sim" ? birthDate : undefined
    });
    
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    // Validação específica para jogadores
    if (isPlayer === "sim") {
      if (!birthDate) {
        toast.error("Data de nascimento é obrigatória para jogadores");
        return;
      }
      
      if (!newPlayer.position) {
        toast.error("Posição é obrigatória para jogadores");
        return;
      }

      // Validação de data de nascimento
      const birthDateObj = new Date(birthDate);
      const today = new Date();
      if (birthDateObj > today) {
        toast.error("Data de nascimento não pode ser no futuro");
        return;
      }
      if (birthDateObj < new Date('1900-01-01')) {
        toast.error("Data de nascimento inválida");
        return;
      }
    }

    try {
      setLoading(true);
      
      // Criar conta de autenticação
      const { data, error } = await supabase.auth.signUp({
        email: validation.data.email,
        password: validation.data.password,
        options: {
          data: {
            first_name: validation.data.first_name,
            last_name: validation.data.last_name,
            is_player: isPlayer === "sim",
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;
      
      if (data.user) {
        // Se for jogador, chamar Edge Function para vincular/criar player_id
        if (isPlayer === "sim") {
          const { data: linkResult, error: linkError } = await supabase.functions.invoke('link-player', {
            body: {
              auth_user_id: data.user.id,
              email: validation.data.email,
              birth_date: birthDate,
              first_name: validation.data.first_name,
              last_name: validation.data.last_name,
              position: newPlayer.position,
            }
          });

          if (linkError) {
            console.error("Erro ao vincular jogador:", linkError);
            toast.error("Erro ao vincular jogador: " + linkError.message);
            return;
          }

          toast.success(linkResult.message);
        } else {
          toast.success("Conta criada com sucesso! Você pode acessar as informações do sistema.");
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

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
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
      <Card className="w-full max-w-md card-glow bg-card border-border relative z-10 mb-8">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center mb-6">
            <img src={novoLogo} alt="Logo" className="h-48 w-auto object-contain" />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="firstName">Primeiro Nome</Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="Seu primeiro nome"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Sobrenome</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Seu sobrenome"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="isPlayer">Você é jogador?</Label>
                  <Select value={isPlayer} onValueChange={setIsPlayer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isPlayer === "sim" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="birthDate">Data de Nascimento</Label>
                      <Input
                        id="birthDate"
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="position">Posição</Label>
                      <Select value={newPlayer.position} onValueChange={(value) => setNewPlayer({...newPlayer, position: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a posição" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="goleiro">Goleiro</SelectItem>
                          <SelectItem value="defensor">Defensor</SelectItem>
                          <SelectItem value="meio-campista">Meio-Campista</SelectItem>
                          <SelectItem value="atacante">Atacante</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-secondary text-primary-foreground font-bold"
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
      <Footer />
    </div>
  );
}
