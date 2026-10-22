import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { calcularRota, listarEstacoes } from "./rota.ts";
import fs from "fs";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

const SALT_ROUNDS = 10;
const JWT_EXPIRES_IN = "2h";
const RECARGA_MAXIMA = 500;
const PRECO_BILHETE = 5.20;
const MAX_BILHETES = 20;
// Sem fallback embutido: um valor fixo no código-fonte de um repositório público
// não é segredo nenhum — qualquer um forjaria um token válido para qualquer usuário.
function lerJwtSecret(): string {
    const secret = process.env.JWT_SECRET;

    const COMO_GERAR = "[server] Ex.: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"";

    if (!secret) {
        console.error("[server] JWT_SECRET não definido. Copie .env.example para .env e defina um valor aleatório longo.");
        console.error(COMO_GERAR);
        process.exit(1);
    }

    // Um segredo curto derrota o propósito: é adivinhável por força bruta.
    if (secret.length < 32) {
        console.error(`[server] JWT_SECRET tem ${secret.length} caracteres; use ao menos 32.`);
        console.error(COMO_GERAR);
        process.exit(1);
    }

    return secret;
}

const JWT_SECRET = lerJwtSecret();

// Tetos configuráveis por variável de ambiente: a suíte e2e exercita as mesmas
// rotas dezenas de vezes em poucos segundos e seria bloqueada pelos próprios
// limites. Em produção vale o padrão de cada um.
function teto(variavel: string, padrao: number) {
    return Number(process.env[variavel]) || padrao;
}

// Sem isso, /api/login aceita tentativas ilimitadas — força bruta trivial.
const limiteLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: teto("RATE_LIMIT_LOGIN", 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { mensagem: "Muitas tentativas de login. Tente novamente em alguns minutos." },
});

const limiteCadastro = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: teto("RATE_LIMIT_CADASTRO", 20),
    standardHeaders: true,
    legacyHeaders: false,
    message: { mensagem: "Muitas contas criadas a partir deste endereço. Tente mais tarde." },
});

// Teto por operação sozinho não impede saldo infinito: bastava repetir a chamada.
const limiteSaldo = rateLimit({
    windowMs: 60 * 1000,
    limit: teto("RATE_LIMIT_SALDO", 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { mensagem: "Muitas operações de saldo seguidas. Aguarde um instante." },
});

// O cálculo de rota percorre a rede inteira a cada chamada. É barato, mas não a
// ponto de valer a pena deixar em rajada livre.
const limiteRota = rateLimit({
    windowMs: 60 * 1000,
    limit: Number(process.env.RATE_LIMIT_ROTA) || 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { mensagem: "Muitos cálculos de trajeto seguidos. Aguarde um instante." },
});

// Rotas de escrita que faltavam limite: /api/denuncias incha um arquivo JSON, e
// /api/alerta/localizacao é alimentada por watchPosition, que dispara sozinho.
const limiteDenuncia = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: teto("RATE_LIMIT_DENUNCIA", 20),
    standardHeaders: true,
    legacyHeaders: false,
    message: { mensagem: "Muitas denúncias enviadas seguidas. Aguarde um pouco." },
});

const limiteLocalizacao = rateLimit({
    windowMs: 60 * 1000,
    limit: teto("RATE_LIMIT_LOCALIZACAO", 30),
    standardHeaders: true,
    legacyHeaders: false,
    message: { mensagem: "Muitas atualizações de localização." },
});

interface AuthPayload {
    id: number;
    email: string;
}

interface AuthRequest extends Request {
    user?: AuthPayload;
}

function gerarToken(usuario: AuthPayload) {
    return jwt.sign(usuario, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, algorithm: "HS256" });
}

// Middleware: exige um Bearer token válido e expõe o usuário autenticado em req.user.
// Nenhuma rota protegida deve mais confiar em email/id/cpf vindos do corpo da requisição.
function autenticar(req: AuthRequest, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ mensagem: "Token de autenticação ausente" });
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as AuthPayload;
        next();
    } catch {
        // 401 e não 403: "não sei quem você é". O 403 fica reservado para
        // "sei quem você é, mas esta ação não é permitida" — como o CPF que não
        // confere em /api/alerta/confirmar. Sem essa separação o cliente não
        // consegue distinguir sessão expirada de recusa por regra de negócio.
        return res.status(401).json({ mensagem: "Token inválido ou expirado" });
    }
}

const server = express();

// Atrás de um proxy reverso (Render, Railway, Nginx...) todas as requisições chegam
// com o IP do proxy, e o rate limit passaria a tratar todos os usuários como um só —
// bastaria uma pessoa errando a senha para travar o login de todo mundo. Precisa ser
// ligado apenas quando existe proxy de fato, senão o IP vira falsificável por header.
if (process.env.TRUST_PROXY) {
    server.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

// O app agora é servido por este mesmo servidor (same-origin), então CORS só
// precisa cobrir o desenvolvimento — e não qualquer origem da internet.
const ORIGENS_PERMITIDAS = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
    : ["http://localhost:5001", "http://127.0.0.1:5001", "http://localhost:5500", "http://127.0.0.1:5500"];

server.use(cors({
    origin: (origin, callback) => {
        // sem Origin = mesma origem, curl, app nativo: liberado
        // Origem não permitida devolve `false`, não Error: lançar aqui viraria um 500
        // com stack trace (e o caminho absoluto do projeto) no corpo da resposta.
        // Sem os headers de CORS, o próprio navegador já bloqueia a leitura.
        callback(null, !origin || ORIGENS_PERMITIDAS.includes(origin));
    },
}));
server.use(express.json({ limit: "100kb" }));

// usuario.json fica fora de `assets/` de propósito: essa pasta é servida
// como estática (express.static abaixo), então qualquer arquivo dentro dela
// é baixável por qualquer um. O "banco" não pode estar num diretório público.
// DB_PATH é configurável via env var só para a suíte de testes usar um arquivo
// isolado (nunca o banco real do desenvolvedor); em produção/dev ninguém define
// essa variável, então o caminho padrão abaixo continua valendo.
const DB_PATH = process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.join(__dirname, "..", "..", "data", "usuario.json");
// usuario.json é o banco local (gitignorado) — nasce a partir do seed versionado
// na primeira execução, pra ninguém acabar commitando dado de cadastro real.
const DB_SEED_PATH = path.join(__dirname, "..", "..", "data", "usuario.seed.json");

if (!fs.existsSync(DB_PATH)) {
    try {
        fs.copyFileSync(DB_SEED_PATH, DB_PATH);
        console.log(`[server] Banco local criado a partir de ${path.basename(DB_SEED_PATH)}`);
    } catch (err) {
        console.error(`[server] Não foi possível criar ${DB_PATH} a partir do seed.`);
        console.error("[server] Confira se data/usuario.seed.json existe e se data/ permite escrita.");
        process.exit(1);
    }
}

// O que pode sair do servidor sobre um usuário. Antes cada rota fazia
// `const { senha, ...usuarioSafe } = usuario`, devolvendo tudo o que não fosse
// senha — então, quando o alerta passou a gravar `localizacao`, a posição GPS
// começou a vazar em respostas de saldo, compra e login. Lista explícita evita
// que o próximo campo sensível se espalhe sozinho.
function usuarioPublico(usuario: any) {
    return {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        saldo: usuario.saldo,
        alerta: usuario.alerta,
    };
}

// Desligar o alerta e apagar a localização são a MESMA regra. Estavam separados:
// só /api/alerta/confirmar limpava, então desligar por PUT /api/alerta deixava a
// última posição gravada para sempre.
function desligarAlerta(usuario: any) {
    usuario.alerta = false;
    delete usuario.localizacao;
}

function localizacaoExpirada(localizacao: any) {
    if (!localizacao?.em) return false;
    const idadeHoras = (Date.now() - new Date(localizacao.em).getTime()) / 3_600_000;
    return idadeHoras > LOCALIZACAO_TTL_HORAS;
}

function readDB() {
    const data = fs.readFileSync(DB_PATH, 'utf-8')
    const db = JSON.parse(data)

    // Descarta posições vencidas na leitura, para que nunca sejam usadas nem
    // devolvidas — e grava de volta, para não ficarem no arquivo em repouso.
    let expirou = false;
    for (const usuario of db.usuarios) {
        if (localizacaoExpirada(usuario.localizacao)) {
            delete usuario.localizacao;
            expirou = true;
        }
    }
    if (expirou) writeDB(db);

    return db
}

function writeDB(data: any) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
}

// Atalho de desenvolvimento: quando LOGIN_DEMO=1, a tela de login oferece um
// botão que entra com a conta de demonstração em um clique. A autenticação em si
// continua valendo — o atalho apenas preenche credenciais que já são públicas
// (estão no seed e na documentação). Nenhuma rota deixa de exigir token.
server.get("/api/config", (_req: Request, res: Response) => {
    return res.json({
        loginDemo: process.env.LOGIN_DEMO === "1",
        emailDemo: process.env.LOGIN_DEMO === "1" ? "ana.souza@example.com" : null,
        // A tela de compra precisa da tarifa e do teto para calcular o total e
        // travar o contador. Antes repetia os dois números no JavaScript dela, e
        // mudar a tarifa aqui deixava a tela mostrando um valor que o servidor
        // não cobraria.
        precoBilhete: PRECO_BILHETE,
        maxBilhetes: MAX_BILHETES,
    });
});

server.post("/api/cadastro", limiteCadastro, (req: Request, res: Response) => {
    try {
        const { email, cpf, senha } = req.body

        if (!email || !cpf || !senha) {
            return res.status(400).json({
                mensagem: "Todos os campos são obrigatórios"
            })
        }

        const db = readDB()

        const userExists = db.usuarios.some((user: any) => 
            user.email === email || user.cpf === cpf
        )

        if (userExists) {
            return res.status(400).json({
                mensagem: "Usuário já cadastrado"
            })
        }

        const senhaHash = bcrypt.hashSync(senha, SALT_ROUNDS)

        // maior id + 1, e não length + 1: com um usuário removido, length repetiria um id existente
        const proximoId = db.usuarios.reduce((maior: number, u: any) => Math.max(maior, Number(u.id) || 0), 0) + 1

        const newUser = {
            id: proximoId,
            nome: "Temporário",
            cpf,
            email,
            senha: senhaHash,
            saldo: 0,
            alerta: false
        }

        db.usuarios.push(newUser)
        writeDB(db)

        const token = gerarToken({ id: newUser.id, email: newUser.email })

        res.status(201).json({
            mensagem: "Cadastro realizado com sucesso",
            usuario: usuarioPublico(newUser),
            token
        })

    } catch (error) {
        console.error('[POST /api/cadastro] Erro:', error); // Log de erro
        res.status(500).json({
            mensagem: "Erro interno do servidor"
        })
    }
})

server.put("/api/usuario/apelido", autenticar, (req: AuthRequest, res: Response) => {
    try {
        const email = req.user!.email
        const { apelido } = req.body

        if (!apelido || typeof apelido !== "string" || !apelido.trim()) {
            return res.status(400).json({
                mensagem: "Apelido é obrigatório"
            })
        }

        // O maxlength do campo é só da interface: sem esta checagem o banco
        // aceitava apelidos de dezenas de milhares de caracteres, e a saudação
        // da home empurrava a foto de perfil para fora da tela.
        if (apelido.trim().length > MAX_APELIDO) {
            return res.status(400).json({
                mensagem: `O apelido pode ter no máximo ${MAX_APELIDO} caracteres`
            })
        }

        const db = readDB()
        const userIndex = db.usuarios.findIndex((user: any) => user.email === email)

        if (userIndex === -1) {
            return res.status(404).json({
                mensagem: "Usuário não encontrado"
            })
        }

        db.usuarios[userIndex].nome = apelido.trim()
        writeDB(db)

        return res.status(200).json({
            mensagem: "Apelido atualizado com sucesso"
        })

    } catch (error) {
        console.error('[PUT /api/usuario/apelido] Erro:', error)
        return res.status(500).json({
            mensagem: "Erro interno do servidor"
        })
    }
})

//Rota put para adicioanr saldo
server.put("/api/usuario/saldo", autenticar, limiteSaldo, (req: AuthRequest, res: Response) => {
    try {
        const email = req.user!.email
        const { amount } = req.body;

        if (typeof amount === "undefined") {
            return res.status(400).json({ mensagem: "amount é obrigatório" });
        }

        // Recarga é simulada (não há gateway de pagamento), mas ainda assim o valor
        // não pode vir livre do cliente: sem teto, qualquer um se daria saldo infinito.
        if (typeof amount !== "number") {
            return res.status(400).json({ mensagem: "amount deve ser um número" });
        }

        const valor = amount;

        if (!Number.isFinite(valor) || valor <= 0) {
            return res.status(400).json({ mensagem: "amount deve ser um número positivo" });
        }

        if (valor > RECARGA_MAXIMA) {
            return res.status(400).json({ mensagem: `Recarga máxima por operação é R$ ${RECARGA_MAXIMA}` });
        }

        const db = readDB();
        const userIndex = db.usuarios.findIndex((u: any) => u.email === email);

        if (userIndex === -1) {
            return res.status(404).json({ mensagem: "Usuário não encontrado" });
        }

        const atual = Number(db.usuarios[userIndex].saldo || 0);
        db.usuarios[userIndex].saldo = Number((atual + valor).toFixed(2));
        writeDB(db);

        return res.status(200).json({ mensagem: "Saldo atualizado com sucesso", usuario: usuarioPublico(db.usuarios[userIndex]) });
    } catch (error) {
        console.error('[PUT /api/usuario/saldo] Erro:', error);
        return res.status(500).json({ mensagem: "Erro interno do servidor" });
    }
})

// Comprar bilhete CREDITA a carteira: o usuário paga por fora (Pix/cartão/boleto) e o
// valor vira saldo no app. O desconto acontece depois, na catraca, ao passar o QR code.
// O preço fica aqui, e não no cliente: senão bastaria mandar o valor que quisesse.
server.post("/api/usuario/compra", autenticar, limiteSaldo, (req: AuthRequest, res: Response) => {
    try {
        const email = req.user!.email;
        const { quantidade } = req.body;

        if (!Number.isInteger(quantidade) || quantidade <= 0 || quantidade > MAX_BILHETES) {
            return res.status(400).json({
                mensagem: `quantidade deve ser um inteiro entre 1 e ${MAX_BILHETES}`
            });
        }

        const db = readDB();
        const userIndex = db.usuarios.findIndex((u: any) => u.email === email);

        if (userIndex === -1) {
            return res.status(404).json({ mensagem: "Usuário não encontrado" });
        }

        const total = Number((quantidade * PRECO_BILHETE).toFixed(2));
        const atual = Number(db.usuarios[userIndex].saldo || 0);

        db.usuarios[userIndex].saldo = Number((atual + total).toFixed(2));
        writeDB(db);

        return res.status(200).json({
            mensagem: "Compra realizada com sucesso",
            quantidade,
            total,
            usuario: usuarioPublico(db.usuarios[userIndex])
        });
    } catch (error) {
        console.error('[POST /api/usuario/compra] Erro:', error);
        return res.status(500).json({ mensagem: "Erro interno do servidor" });
    }
});

// --- Denúncias ---
// Ficam em arquivo próprio, e não dentro do usuário: uma denúncia anônima não pode
// estar aninhada no registro de quem a fez, senão de anônima não tem nada.
const DENUNCIAS_PATH = process.env.DENUNCIAS_PATH
    ? path.resolve(process.env.DENUNCIAS_PATH)
    : path.join(__dirname, "..", "..", "data", "denuncias.json");

const CATEGORIAS = ["assedio", "roubo", "outros"] as const;
const MAX_DESCRICAO = 1000;
const MAX_LOCAL = 200;
const MAX_APELIDO = 40;
// Localização de emergência não deve envelhecer no banco. É apagada ao desligar o
// alerta, mas quem nunca desliga deixaria a posição gravada para sempre.
const LOCALIZACAO_TTL_HORAS = 6;

function readDenuncias() {
    if (!fs.existsSync(DENUNCIAS_PATH)) {
        return { denuncias: [] as any[] };
    }
    return JSON.parse(fs.readFileSync(DENUNCIAS_PATH, "utf-8"));
}

function writeDenuncias(data: any) {
    fs.writeFileSync(DENUNCIAS_PATH, JSON.stringify(data, null, 2));
}

server.post("/api/denuncias", autenticar, limiteDenuncia, (req: AuthRequest, res: Response) => {
    try {
        const { categoria, descricao, local, anonima } = req.body;

        if (!CATEGORIAS.includes(categoria)) {
            return res.status(400).json({
                mensagem: `categoria deve ser uma de: ${CATEGORIAS.join(", ")}`
            });
        }

        if (typeof descricao !== "string" || descricao.trim().length < 10) {
            return res.status(400).json({
                mensagem: "Descreva o ocorrido com pelo menos 10 caracteres"
            });
        }

        if (descricao.length > MAX_DESCRICAO) {
            return res.status(400).json({
                mensagem: `A descrição pode ter no máximo ${MAX_DESCRICAO} caracteres`
            });
        }

        const db = readDenuncias();
        const proximoId = db.denuncias.reduce(
            (maior: number, d: any) => Math.max(maior, Number(d.id) || 0), 0
        ) + 1;

        const denuncia = {
            id: proximoId,
            protocolo: `CPTM-${String(proximoId).padStart(6, "0")}`,
            categoria,
            descricao: descricao.trim(),
            local: typeof local === "string" && local.trim() ? local.trim().slice(0, MAX_LOCAL) : null,
            // Anônima não guarda o autor. É o ponto todo da opção.
            usuarioId: anonima === true ? null : req.user!.id,
            anonima: anonima === true,
            em: new Date().toISOString(),
        };

        db.denuncias.push(denuncia);
        writeDenuncias(db);

        return res.status(201).json({
            mensagem: "Denúncia registrada",
            protocolo: denuncia.protocolo,
            em: denuncia.em,
        });
    } catch (error) {
        console.error("[POST /api/denuncias] Erro:", error);
        return res.status(500).json({ mensagem: "Erro interno do servidor" });
    }
});

// Lista apenas as denúncias identificadas do próprio usuário. As anônimas não
// aparecem nem para quem as enviou — não há como provar autoria sem quebrar o anonimato.
server.get("/api/denuncias", autenticar, (req: AuthRequest, res: Response) => {
    try {
        const db = readDenuncias();
        const minhas = db.denuncias
            .filter((d: any) => d.usuarioId === req.user!.id)
            .map(({ usuarioId: _u, ...resto }: any) => resto);

        return res.status(200).json({ denuncias: minhas });
    } catch (error) {
        console.error("[GET /api/denuncias] Erro:", error);
        return res.status(500).json({ mensagem: "Erro interno do servidor" });
    }
});

// Passagem na catraca: aqui sim o saldo é DEBITADO, no valor de uma passagem.
// É a contraparte de /api/usuario/compra, que credita a carteira.
server.post("/api/usuario/passagem", autenticar, limiteSaldo, (req: AuthRequest, res: Response) => {
    try {
        const email = req.user!.email;

        const db = readDB();
        const userIndex = db.usuarios.findIndex((u: any) => u.email === email);

        if (userIndex === -1) {
            return res.status(404).json({ mensagem: "Usuário não encontrado" });
        }

        const atual = Number(db.usuarios[userIndex].saldo || 0);

        // A catraca recusa em vez de deixar o saldo negativo.
        if (atual < PRECO_BILHETE) {
            return res.status(400).json({
                mensagem: "Saldo insuficiente para a passagem",
                saldo: atual,
                preco: PRECO_BILHETE
            });
        }

        db.usuarios[userIndex].saldo = Number((atual - PRECO_BILHETE).toFixed(2));
        writeDB(db);

        return res.status(200).json({
            mensagem: "Passagem liberada",
            preco: PRECO_BILHETE,
            usuario: usuarioPublico(db.usuarios[userIndex])
        });
    } catch (error) {
        console.error('[POST /api/usuario/passagem] Erro:', error);
        return res.status(500).json({ mensagem: "Erro interno do servidor" });
    }
});

/**
 * GET /api/estacoes
 * Retorna lista de todas as estações únicas do sistema.
 * 
 * Extrai nomes das estações do arquivo estacoes.json,
 * remove duplicatas e retorna array ordenado alfabeticamente.
 */
server.get("/api/estacoes", (_req: Request, res: Response) => {
    try {
        return res.json(listarEstacoes());
    } catch (err) {
        console.error("Erro ao ler estacoes.json:", err);
        return res.status(500).json({ error: "Erro ao ler estações" });
    }
});

/**
 * GET /api/rota?origem=&destino=
 * Trajeto entre duas estações: por quais linhas se passa, onde se baldeia e
 * quantas paradas são. Substitui o /gera-mapa, que dependia de Python e desenhava
 * as estações em coordenadas que ele mesmo inventava.
 */
server.get("/api/rota", limiteRota, (req: Request, res: Response) => {
    const origem = String(req.query.origem || "").trim();
    const destino = String(req.query.destino || "").trim();

    if (!origem || !destino) {
        return res.status(400).json({ mensagem: "origem e destino são obrigatórios" });
    }

    try {
        const rota = calcularRota(origem, destino);
        if (!rota) {
            return res.status(404).json({ mensagem: "Não há trajeto entre essas estações" });
        }
        return res.json(rota);
    } catch (err) {
        console.error("[GET /api/rota] Erro:", err);
        return res.status(500).json({ mensagem: "Erro interno do servidor" });
    }
});

// As telas .html ficam na raiz do projeto, junto de data/, .env, node_modules e .git.
// Servir a raiz inteira e tentar bloquear o que é sensível não funciona: um blocklist
// por prefixo é furado por "//data/x", "/data%2Fx" e "/./data/x", que só são
// normalizados depois, dentro do express.static. Por isso a regra aqui é allowlist —
// serve-se apenas assets/ e as páginas .html, e nada mais fica alcançável.
const ROOT_DIR = path.join(__dirname, "..", "..");

// Só as subpastas de fato públicas. `assets/src/` fica de fora de propósito: guarda
// o código do backend, que não tem por que ser baixável.
for (const pasta of ["css", "js", "imagem", "sons", "fontes"]) {
	server.use(`/assets/${pasta}`, express.static(path.join(ROOT_DIR, "assets", pasta), { dotfiles: "deny" }));
}

const PAGINAS = new Set(
	fs.readdirSync(ROOT_DIR).filter((arquivo) => arquivo.endsWith(".html"))
);

server.get("/:pagina", (req: Request, res: Response, next: NextFunction) => {
	// basename() descarta qualquer tentativa de traversal antes da checagem
	const pagina = path.basename(String(req.params.pagina));

	if (!PAGINAS.has(pagina)) {
		return next();
	}

	return res.sendFile(path.join(ROOT_DIR, pagina));
});

server.get("/", (req: Request, res: Response) => {
	res.redirect('/login.html');
});

// ROTA LOGIN | INICIO

server.post("/api/login", limiteLogin, (req: Request, res: Response) => {
    try {
        // Nunca logar req.body aqui: ele carrega a senha em texto puro.
        // Sem o e-mail: registrar quem tentou entrar, a cada tentativa, deixa
        // dado pessoal no log do servidor sem que isso ajude a operar nada.
        console.log('[POST /api/login] Tentativa de login recebida');

        const { email, senha } = req.body;
        if (!email || !senha) {
            console.warn('[POST /api/login] Erro 400: campos faltando');
            return res.status(400).json({ mensagem: "Email e senha são obrigatórios" });
        }

        const db = readDB();
        const user = db.usuarios.find((u: any) => u.email === email);

        if (!user) {
            // Sem distinguir "não existe" de "senha errada", e sem o e-mail: a
            // resposta já é a mesma nos dois casos justamente para não revelar
            // quais contas existem, e o log não pode desfazer isso.
            console.warn('[POST /api/login] Erro 401: credencial inválida');
            return res.status(404).json({ mensagem: "Usuário não encontrado" });
        }

        if (!bcrypt.compareSync(senha, user.senha)) {
            console.warn('[POST /api/login] Erro 401: credencial inválida');
            return res.status(401).json({ mensagem: "Credenciais inválidas" });
        }

        // Remover a senha do objeto retornado
        const token = gerarToken({ id: user.id, email: user.email });
        console.log('[POST /api/login] Login bem-sucedido');

        return res.status(200).json({
            mensagem: "Login efetuado com sucesso",
            usuario: usuarioPublico(user),
            token
        });
    } catch (error) {
        console.error('[POST /api/login] Erro:', error);
        return res.status(500).json({ mensagem: "Erro interno do servidor" });
    }
})

// ROTA LOGIN | FIM
// ROTA DENUNCIA | INICIO 

server.put("/api/alerta", autenticar, (req: AuthRequest, res: Response) => {
    try {
      const id = req.user!.id;
      const { alerta } = req.body;

      // Verifica se veio o parâmetro necessário
      if (typeof alerta === "undefined") {
        return res.sendStatus(400);
      }

      const db = readDB();
      const usuario = db.usuarios.find((u: any) => Number(u.id) === Number(id));

      if (!usuario) {
        return res.sendStatus(404);
      }

      // Normaliza para boolean: a string "false" é truthy em JS, e um cliente que
      // mandasse {"alerta":"false"} acreditaria ter desligado sem ter desligado.
      if (alerta === true) {
        usuario.alerta = true;
      } else {
        desligarAlerta(usuario);
      }
      writeDB(db);
      return res.sendStatus(200);
    } catch {
      return res.sendStatus(500);
    }
  });

  // --- Localização durante o alerta ---
  // Recebe a posição enviada pelo botão "Me encontre" e guarda a última conhecida
  // junto do usuário. Só faz sentido com o alerta ligado, e é apagada ao desligar:
  // localização é dado sensível, não deve sobreviver ao fim da emergência.
  server.post("/api/alerta/localizacao", autenticar, limiteLocalizacao, (req: AuthRequest, res: Response) => {
    try {
      const { lat, lng, precisao } = req.body;

      if (typeof lat !== "number" || typeof lng !== "number") {
        return res.status(400).json({ mensagem: "lat e lng são obrigatórios e numéricos" });
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ mensagem: "Coordenadas fora do intervalo válido" });
      }

      const db = readDB();
      const usuario = db.usuarios.find((u: any) => Number(u.id) === Number(req.user!.id));

      if (!usuario) {
        return res.status(404).json({ mensagem: "Usuário não encontrado" });
      }

      if (!usuario.alerta) {
        return res.status(409).json({ mensagem: "Nenhum alerta ativo para este usuário" });
      }

      usuario.localizacao = {
        lat,
        lng,
        precisao: typeof precisao === "number" ? Math.round(precisao) : null,
        em: new Date().toISOString(),
      };
      writeDB(db);

      return res.status(200).json({ mensagem: "Localização registrada" });
    } catch (error) {
      console.error("[POST /api/alerta/localizacao] Erro:", error);
      return res.status(500).json({ mensagem: "Erro interno do servidor" });
    }
  });

  // --- Confirma CPF e desativa o alerta ---
  // Exige o token de quem está logado E que o CPF digitado bata com o CPF
  // cadastrado para ESSE usuário — não basta saber o CPF de outra pessoa.
  server.post("/api/alerta/confirmar", autenticar, (req: AuthRequest, res: Response) => {
    try {
      const { cpf } = req.body;
      if (!cpf) return res.sendStatus(400);

      const db = readDB();
      const usuario = db.usuarios.find((u: any) => Number(u.id) === Number(req.user!.id));

      if (!usuario) return res.sendStatus(404);

      // Compara só os dígitos. A comparação era literal, então um CPF digitado
      // com ponto e traço — que é como a tela de cadastro ensina a escrever —
      // era recusado num fluxo de emergência, com o alarme tocando.
      const soDigitos = (valor: unknown) => String(valor ?? "").replace(/\D/g, "");
      if (soDigitos(usuario.cpf) !== soDigitos(cpf)) return res.sendStatus(403);

      desligarAlerta(usuario);
      writeDB(db);

      return res.sendStatus(200);
    } catch {
      return res.sendStatus(500);
    }
  });

// Inicia o servidor HTTP caso este arquivo seja executado diretamente.
// Usa a porta definida em PORT ou 5001 (padrão usado no frontend).
const PORT = process.env.PORT ? Number(process.env.PORT) : 5001;

function startServer() {
    const httpServer = server.listen(PORT, () => {
        console.log(`[server] App em http://127.0.0.1:${PORT}`);
    });

    httpServer.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
            // Sem encerrar o processo: com `tsx watch`, sair aqui mata o
            // observador junto, e a partir daí salvar um arquivo não recarrega
            // mais nada — sem nenhuma mensagem dizendo por quê. Mantendo o
            // processo vivo, a próxima alteração tenta subir de novo.
            console.error(`[server] A porta ${PORT} já está em uso. Encerre o outro processo ou use PORT=<outra> npm run dev`);
            return;
        }

        console.error('[server] Erro no servidor:', err);
        process.exit(1);
    });
}

// === NOVA ROTA PARA OBTER SALDO DO USUÁRIO ===
server.get("/api/usuario", autenticar, (req: AuthRequest, res: Response) => {
  try {
    const email = req.user!.email;

    const db = readDB();
    const usuario = db.usuarios.find((u: any) => u.email === email);

    if (!usuario) {
      return res.status(404).json({ mensagem: "Usuário não encontrado" });
    }

    return res.status(200).json({
      mensagem: "Usuário encontrado",
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        saldo: usuario.saldo,
      },
    });
  } catch (error) {
    console.error("[GET /api/usuario] Erro:", error);
    return res.status(500).json({ mensagem: "Erro interno do servidor" });
  }
});

// Só sobe o listener de verdade fora dos testes: a suíte importa `server`
// (o app do Express) diretamente e sobe sua própria instância em porta
// efêmera, então chamar startServer() aqui subiria um segundo servidor
// competindo pela porta fixa (5001) a cada arquivo de teste.
// Último middleware: sem ele, qualquer erro não tratado cai no handler padrão do
// Express, que responde HTML com stack trace e o caminho absoluto do projeto.
server.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[server] Erro não tratado:", err);

    if (res.headersSent) {
        return;
    }

    const status = (err as any).status || (err as any).statusCode || 500;
    return res.status(status).json({ mensagem: status === 500 ? "Erro interno do servidor" : err.message });
});

if (process.env.NODE_ENV !== "test") {
    startServer();
}

// Export nomeado além do default: sob `module: Node16` este arquivo é CommonJS,
// e aí o `default` de um import dinâmico fica ambíguo para o TypeScript.
export { server };
export default server;
