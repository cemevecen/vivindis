import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "..", "src", "messages");

const PACK = {
  de: {
    meta: {
      siteDescription:
        "SaaS-Plattform zum Abrufen und Analysieren von Google Play- und App Store-Bewertungen im großen Maßstab.",
    },
    errors: {
      boundaryTitle: "Etwas ist schiefgelaufen",
      boundaryDescription: "Sie können es erneut versuchen oder zur Startseite zurückkehren.",
      boundaryRetry: "Erneut versuchen",
      boundaryHome: "Startseite",
      globalTitle: "Kritischer Fehler",
      globalDescription:
        "Die Oberfläche konnte nicht geladen werden. In der Entwicklung: alle next dev-Prozesse beenden, rm -rf .next ausführen und neu starten.",
      globalRetry: "Erneut versuchen",
    },
  },
  fr: {
    meta: {
      siteDescription:
        "Plateforme SaaS qui récupère et analyse à grande échelle les avis Google Play et App Store.",
    },
    errors: {
      boundaryTitle: "Une erreur s’est produite",
      boundaryDescription: "Vous pouvez réessayer ou revenir à l’accueil.",
      boundaryRetry: "Réessayer",
      boundaryHome: "Accueil",
      globalTitle: "Erreur critique",
      globalDescription:
        "L’interface n’a pas pu se charger. En développement : arrêtez tous les processus next dev, exécutez rm -rf .next puis redémarrez.",
      globalRetry: "Réessayer",
    },
  },
  es: {
    meta: {
      siteDescription:
        "Plataforma SaaS que obtiene y analiza reseñas de Google Play y App Store a escala.",
    },
    errors: {
      boundaryTitle: "Algo salió mal",
      boundaryDescription: "Puede intentarlo de nuevo o volver al inicio.",
      boundaryRetry: "Reintentar",
      boundaryHome: "Inicio",
      globalTitle: "Error crítico",
      globalDescription:
        "No se pudo cargar la interfaz. En desarrollo: detenga todos los procesos next dev, ejecute rm -rf .next y reinicie.",
      globalRetry: "Reintentar",
    },
  },
  it: {
    meta: {
      siteDescription:
        "Piattaforma SaaS che recupera e analizza le recensioni di Google Play e App Store su larga scala.",
    },
    errors: {
      boundaryTitle: "Qualcosa è andato storto",
      boundaryDescription: "Puoi riprovare o tornare alla home.",
      boundaryRetry: "Riprova",
      boundaryHome: "Home",
      globalTitle: "Errore critico",
      globalDescription:
        "Impossibile caricare l’interfaccia. In sviluppo: fermare tutti i processi next dev, eseguire rm -rf .next e riavviare.",
      globalRetry: "Riprova",
    },
  },
  pt: {
    meta: {
      siteDescription:
        "Plataforma SaaS que obtém e analisa avaliações da Google Play e App Store em escala.",
    },
    errors: {
      boundaryTitle: "Algo correu mal",
      boundaryDescription: "Pode tentar novamente ou voltar à página inicial.",
      boundaryRetry: "Tentar novamente",
      boundaryHome: "Início",
      globalTitle: "Erro crítico",
      globalDescription:
        "Não foi possível carregar a interface. Em desenvolvimento: pare todos os processos next dev, execute rm -rf .next e reinicie.",
      globalRetry: "Tentar novamente",
    },
  },
  ru: {
    meta: {
      siteDescription:
        "SaaS-платформа для массовой загрузки и анализа отзывов Google Play и App Store.",
    },
    errors: {
      boundaryTitle: "Что-то пошло не так",
      boundaryDescription: "Попробуйте снова или вернитесь на главную.",
      boundaryRetry: "Повторить",
      boundaryHome: "Главная",
      globalTitle: "Критическая ошибка",
      globalDescription:
        "Не удалось загрузить интерфейс. В разработке: остановите все процессы next dev, выполните rm -rf .next и перезапустите.",
      globalRetry: "Повторить",
    },
  },
  ja: {
    meta: {
      siteDescription:
        "Google Play と App Store のレビューを大規模に取得・分析する SaaS プラットフォーム。",
    },
    errors: {
      boundaryTitle: "問題が発生しました",
      boundaryDescription: "再試行するか、ホームに戻ってください。",
      boundaryRetry: "再試行",
      boundaryHome: "ホーム",
      globalTitle: "重大なエラー",
      globalDescription:
        "画面を読み込めませんでした。開発時は next dev をすべて停止し、rm -rf .next の後に再起動してください。",
      globalRetry: "再試行",
    },
  },
  zh: {
    meta: {
      siteDescription: "大规模获取并分析 Google Play 与 App Store 评论的 SaaS 平台。",
    },
    errors: {
      boundaryTitle: "出了点问题",
      boundaryDescription: "您可以重试或返回首页。",
      boundaryRetry: "重试",
      boundaryHome: "首页",
      globalTitle: "严重错误",
      globalDescription: "界面无法加载。开发环境下请停止所有 next dev 进程，执行 rm -rf .next 后重启。",
      globalRetry: "重试",
    },
  },
  ar: {
    meta: {
      siteDescription: "منصة SaaS لجلب وتحليل تقييمات متاجر Google Play وApp Store على نطاق واسع.",
    },
    errors: {
      boundaryTitle: "حدث خطأ ما",
      boundaryDescription: "يمكنك المحاولة مرة أخرى أو العودة إلى الصفحة الرئيسية.",
      boundaryRetry: "إعادة المحاولة",
      boundaryHome: "الرئيسية",
      globalTitle: "خطأ حرج",
      globalDescription:
        "تعذر تحميل الواجهة. في التطوير: أوقف جميع عمليات next dev، ثم نفّذ rm -rf .next وأعد التشغيل.",
      globalRetry: "إعادة المحاولة",
    },
  },
  sw: {
    meta: {
      siteDescription:
        "Jukwaa la SaaS linalovuta na kuchambua ukaguzi wa Google Play na App Store kwa kiwango kikubwa.",
    },
    errors: {
      boundaryTitle: "Kitu kimeenda vibaya",
      boundaryDescription: "Unaweza kujaribu tena au kurudi mwanzo.",
      boundaryRetry: "Jaribu tena",
      boundaryHome: "Mwanzo",
      globalTitle: "Hitilafu kubwa",
      globalDescription:
        "Kiolesura hakuwezi kupakiwa. Katika maendeleo: simamisha next dev zote, tumia rm -rf .next kisha anzisha upya.",
      globalRetry: "Jaribu tena",
    },
  },
};

for (const [locale, extra] of Object.entries(PACK)) {
  const fp = path.join(dir, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(fp, "utf8"));
  data.meta = extra.meta;
  data.errors = extra.errors;
  fs.writeFileSync(fp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log("meta+errors", locale);
}
