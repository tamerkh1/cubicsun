import { motion, AnimatePresence } from "framer-motion";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Copy, RefreshCw, Check, Info } from "lucide-react";

// --- Helpers ---------------------------------------------------------------
const AMBIGUOUS = new Set([
  "l",
  "I",
  "1",
  "O",
  "0",
  "o",
  "S",
  "5",
  "B",
  "8",
  "G",
  "6",
  "Z",
  "2",
]); // easy-to-read filter

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = LOWER.toUpperCase();
const NUM = "0123456789";
const SYM = "!@#$%^&*()-_=+[]{};:,.?";

const VOWELS = "aeiou";
const CONSONANTS = Array.from(LOWER)
  .filter((c) => !VOWELS.includes(c))
  .join("");

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}
function pick(str: string): string {
  return str[randomInt(str.length)];
}

function stripAmbiguous(str: string): string {
  return Array.from(str)
    .filter((c) => !AMBIGUOUS.has(c))
    .join("");
}

function ensureAtLeastOneFromEach(groups: string[], base: string): string {
  let out = base.split("");
  groups.forEach((g) => {
    if (g && g.length) {
      const pos = randomInt(out.length);
      out[pos] = pick(g);
    }
  });
  return out.join("");
}

interface StrengthOptions {
  length: number;
  upper: boolean;
  lower: boolean;
  numbers: boolean;
  symbols: boolean;
  mode: "say" | "read" | "all";
}

function estimateStrength({
  length,
  upper,
  lower,
  numbers,
  symbols,
  mode,
}: StrengthOptions) {
  let classes = 0;
  if (upper) classes++;
  if (lower) classes++;
  if (numbers) classes++;
  if (symbols) classes++;

  if (mode === "say") classes = Math.min(classes, upper || lower ? 1 : 0);

  const score = length * (classes + 1);
  if (score < 30) return { label: "Weak", width: 25 };
  if (score < 60) return { label: "Fair", width: 50 };
  if (score < 90) return { label: "Strong", width: 75 };
  return { label: "Very strong", width: 100 };
}

// --- Generator -------------------------------------------------------------
interface GenerateOptions {
  length: number;
  allowUpper: boolean;
  allowLower: boolean;
  allowNumbers: boolean;
  allowSymbols: boolean;
  mode: "say" | "read" | "all";
}

function generatePassword(opts: GenerateOptions): string {
  const { length, allowUpper, allowLower, allowNumbers, allowSymbols, mode } =
    opts;

  if (mode === "say") {
    let base = "";
    for (let i = 0; i < length; i++) {
      const isVowel = i % 2 === 1;
      let ch = isVowel ? pick(VOWELS) : pick(CONSONANTS);
      if (allowUpper && allowLower) {
        if (Math.random() < 0.5) ch = ch.toUpperCase();
      } else if (allowUpper && !allowLower) {
        ch = ch.toUpperCase();
      }
      base += ch;
    }
    return base;
  }

  let lower = allowLower ? LOWER : "";
  let upper = allowUpper ? UPPER : "";
  let num = allowNumbers ? NUM : "";
  let sym = allowSymbols ? SYM : "";

  if (mode === "read") {
    lower = stripAmbiguous(lower);
    upper = stripAmbiguous(upper);
    num = stripAmbiguous(num);
  }

  if (!lower && !upper && !num && !sym) {
    lower = LOWER;
  }

  const sets = [upper, lower, num, sym].filter(Boolean);
  const all = sets.join("");

  let pwd = new Array(length)
    .fill(0)
    .map(() => pick(all))
    .join("");
  pwd = ensureAtLeastOneFromEach([upper, lower, num, sym], pwd);
  return pwd;
}

// --- UI -------------------------------------------------------------------
export default function PasswordGeneratorApp() {
  const [length, setLength] = useState(12);
  const [allowUpper, setAllowUpper] = useState(true);
  const [allowLower, setAllowLower] = useState(true);
  const [allowNumbers, setAllowNumbers] = useState(true);
  const [allowSymbols, setAllowSymbols] = useState(true);
  const [mode, setMode] = useState<"say" | "read" | "all">("read");
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const passwordRef = useRef(null);

  const strength = useMemo(
    () =>
      estimateStrength({
        length,
        upper: allowUpper,
        lower: allowLower,
        numbers: allowNumbers,
        symbols: allowSymbols,
        mode: mode === "all" ? "all" : mode,
      }),
    [length, allowUpper, allowLower, allowNumbers, allowSymbols, mode]
  );

  const regenerate = () => {
    const pwd = generatePassword({
      length,
      allowUpper,
      allowLower,
      allowNumbers,
      allowSymbols,
      mode,
    });
    setPassword(pwd);
    setCopied(false);
    setCopyStatus("");
  };

  useEffect(() => {
    regenerate();
  }, [length, allowUpper, allowLower, allowNumbers, allowSymbols, mode]);

  function fallbackCopyTextToClipboard(text: string): boolean {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      return false;
    }
  }

  async function handleCopy() {
    if (!password) return;
    setCopyStatus("");
    setCopied(false);

    if (
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      try {
        await navigator.clipboard.writeText(password);
        setCopied(true);
        setCopyStatus("Copied to clipboard");
        setTimeout(() => {
          setCopied(false);
          setCopyStatus("");
        }, 1200);
        return;
      } catch (err) {}
    }

    const fallbackSuccess = fallbackCopyTextToClipboard(password);
    if (fallbackSuccess) {
      setCopied(true);
      setCopyStatus("Copied to clipboard (fallback)");
      setTimeout(() => {
        setCopied(false);
        setCopyStatus("");
      }, 1200);
      return;
    }

    try {
      if (passwordRef.current) {
        const range = document.createRange();
        range.selectNodeContents(passwordRef.current!);
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    } catch (e) {}

    setCopyStatus(
      "Clipboard blocked. Password selected — press Ctrl/Cmd+C to copy."
    );
    setTimeout(() => setCopyStatus(""), 5000);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center p-6">
      <div className="w-full max-w-3xl">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
            Secure Password Generator
          </h1>
          <p className="text-slate-600 mt-1">
            Create strong, customizable passwords with one click.
          </p>
        </header>

        <motion.section
          layout
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6 mb-6"
        >
          <div className="flex items-center gap-3">
            <div
              ref={passwordRef}
              className="font-mono text-xl md:text-2xl text-slate-900 break-all flex-1 select-all"
              aria-live="polite"
            >
              {password}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={regenerate}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50 transition"
                aria-label="Regenerate password"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-3 py-2 hover:opacity-95 transition"
                aria-label="Copy password"
              >
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}{" "}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {copyStatus && (
              <motion.div
                key="copy-status"
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="mt-3 text-sm text-green-600 font-medium"
              >
                {copyStatus}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-slate-600 mb-1">
              <span>Password strength</span>
              <span className="font-medium text-slate-800">
                {strength.label}
              </span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-green-500"
                initial={{ width: 0 }}
                animate={{ width: `${strength.width}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </motion.section>

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Customize your password
          </h2>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label htmlFor="length" className="text-slate-800 font-medium">
                Password Length
              </label>
              <input
                type="number"
                id="length"
                min={6}
                max={64}
                value={length}
                onChange={(e) =>
                  setLength(
                    Math.max(
                      6,
                      Math.min(64, parseInt(e.target.value || "0", 10))
                    )
                  )
                }
                className="w-20 text-right border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <input
              type="range"
              min={6}
              max={64}
              value={length}
              onChange={(e) => setLength(parseInt(e.target.value, 10))}
              className="w-full accent-slate-900"
            />
          </div>

          <div className="grid md:grid-cols-3 gap-3 mb-6">
            <RadioCard
              label="Easy to say"
              description="Pronounceable, letters only"
              checked={mode === "say"}
              onChange={() => setMode("say")}
            />
            <RadioCard
              label="Easy to read"
              description="No ambiguous characters"
              checked={mode === "read"}
              onChange={() => setMode("read")}
            />
            <RadioCard
              label="All characters"
              description="Use your exact selections"
              checked={mode === "all"}
              onChange={() => setMode("all")}
            />
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            <CheckCard
              label="Uppercase"
              checked={allowUpper}
              onChange={setAllowUpper}
            />
            <CheckCard
              label="Lowercase"
              checked={allowLower}
              onChange={setAllowLower}
            />
            <CheckCard
              label="Numbers"
              checked={allowNumbers}
              onChange={setAllowNumbers}
            />
            <CheckCard
              label="Symbols"
              checked={allowSymbols}
              onChange={setAllowSymbols}
            />
          </div>

          <div className="flex items-start gap-2 text-sm text-slate-500 mt-6">
            <Info className="w-4 h-4 mt-0.5" />
            <p>
              "Easy to say" creates pronounceable passwords using only letters.
              "Easy to read" removes look‑alike characters such as 0/O and 1/l.
              "All characters" follows your exact selections above.
            </p>
          </div>
        </section>

        <footer className="text-center text-sm text-slate-600 mt-10 border-t pt-6">
          <p className="font-medium text-lg text-slate-900">— Tamer Alkhatib</p>
          <p className="text-slate-500">📧 tamer.kh1@gmail.com</p>
          <p className="mt-2 text-xs italic">
            Built with ♥ — Remember to store passwords in a secure manager.
          </p>
        </footer>
      </div>
    </div>
  );
}

type RadioCardProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
};

function RadioCard({ label, description, checked, onChange }: RadioCardProps) {
  return (
    <button
      type="button"
      className={`flex flex-col rounded-2xl border p-4 text-left transition shadow-sm hover:shadow-md ${
        checked ? "border-blue-500 ring-2 ring-blue-300" : ""
      }`}
      onClick={onChange}
    >
      <span className="font-medium">{label}</span>
      <span className="text-sm text-gray-500">{description}</span>
    </button>
  );
}

type CheckCardProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function CheckCard({ label, checked, onChange }: CheckCardProps) {
  return (
    <label
      className={`flex items-center gap-3 rounded-2xl border p-4 cursor-pointer select-none transition shadow-sm hover:shadow-md ${
        checked ? "border-blue-500 ring-2 ring-blue-300" : ""
      }`}
    >
      <input
        type="checkbox"
        className="hidden"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="font-medium">{label}</span>
    </label>
  );
}
