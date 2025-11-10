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

const loginSchema = z.object({
  email: z.string().trim().email({ message: "E-mail inválido" }).max(255, { message: "E-mail muito longo" }),
  password: z.string().min(6, { message: "Senha deve ter no mínimo 6 caracteres" }),
});

const signUpSchema = z.object({
  email: z.string().trim().email({ message: "E-mail inválido" }).max(255, { message: "E-mail muito longo" }),
  password: z.string().min(6, { message: "Senha deve ter no mínimo 6 caracteres" }),
  name: z.string().trim().min(1, { message: "Nome é obrigatório" }).max(100, { message: "Nome muito longo" }),
  nickname: z.string().trim().min(1, { message: "Apelido é obrigatório" }).max(50, { message: "Apelido muito longo" }),
  birthDate: z.string().min(1, { message: "Data de nascimento é obrigatória" }),
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
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [isPlayer, setIsPlayer] = useState("nao");
  const [playerType, setPlayerType] = useState("");
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
    const validation = signUpSchema.safeParse({ email, password, name, nickname, birthDate });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    if (isPlayer === "sim" && (!playerType || !newPlayer.level || !newPlayer.position)) {
      toast.error("Por favor, preencha todos os campos de jogador (tipo, nível e posição).");
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

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: validation.data.email,
        password: validation.data.password,
        options: {
          data: {
            name: validation.data.name,
            nickname: validation.data.nickname,
            birth_date: validation.data.birthDate,
            is_player: isPlayer === "sim",
            player_type: isPlayer === "sim" ? playerType : null,
            level: isPlayer === "sim" ? newPlayer.level : null,
            position: isPlayer === "sim" ? newPlayer.position : null,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;
      
      // Update profile with additional data
      if (data.user) {
        const { error: profileError } = await supabase.from("profiles").update({
          nickname: validation.data.nickname,
          birth_date: validation.data.birthDate,
          is_player: isPlayer === "sim",
          player_type_detail: isPlayer === "sim" ? (playerType as "mensal" | "avulso") : null,
          status: isPlayer === "sim" ? "aprovar" : "aprovado",
        }).eq("user_id", data.user.id);

        if (profileError) {
          console.error("Erro ao atualizar perfil:", profileError);
          toast.error("Erro ao atualizar perfil: " + profileError.message);
          return;
        }

        // Se for jogador, criar entrada na tabela players
        if (isPlayer === "sim") {
          const { error: playerError } = await supabase.from("players").insert({
            user_id: data.user.id,
            name: validation.data.name,
            birth_date: validation.data.birthDate,
            level: newPlayer.level as any,
            position: newPlayer.position as any,
          });

          if (playerError) {
            console.error("Erro ao criar jogador:", playerError);
            toast.error("Erro ao criar jogador: " + playerError.message);
            return;
          }
        }

        const message = isPlayer === "sim" 
          ? "Conta criada com sucesso! Aguarde aprovação do administrador para participar das rodadas."
          : "Conta criada com sucesso! Você pode acessar as informações do sistema.";
        
        toast.success(message);
        navigate("/");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
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
      <Card className="w-full max-w-md card-glow bg-card border-border relative z-10">
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
                  <Label htmlFor="name">Nome completo</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nickname">Apelido</Label>
                  <Input
                    id="nickname"
                    type="text"
                    placeholder="Seu apelido"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    required
                  />
                </div>
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
                      <Label htmlFor="playerType">Tipo de Jogador</Label>
                      <Select value={playerType} onValueChange={setPlayerType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mensal">Mensal</SelectItem>
                          <SelectItem value="avulso">Avulso</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="level">Nível</Label>
                      <Select value={newPlayer.level} onValueChange={(value) => setNewPlayer({...newPlayer, level: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o nível" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">A</SelectItem>
                          <SelectItem value="B">B</SelectItem>
                          <SelectItem value="C">C</SelectItem>
                          <SelectItem value="D">D</SelectItem>
                          <SelectItem value="E">E</SelectItem>
                        </SelectContent>
                      </Select>
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
    </div>
  );
}
