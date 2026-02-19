import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { parseQuoteText } from "@/lib/quoteUtils";

const Submit = () => {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!text.trim()) return;
    const parsed = parseQuoteText(text);
    await supabase.from("suggestions").insert({
      raw_text: text,
      parsed_speakers: parsed.speakers as any,
      speaker_count: parsed.speaker_count,
    });
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background p-6 sm:p-12">
      <div className="mx-auto max-w-[800px] border border-foreground p-8 sm:p-12">
        <h1 className="text-2xl font-bold text-foreground mb-8 font-serif">
          Submit a Quote
        </h1>

        {submitted ? (
          <div>
            <p className="text-foreground mb-6">thank you – quote sent for review</p>
            <button
              onClick={() => navigate("/")}
              className="text-foreground text-sm hover:underline bg-background border-none cursor-pointer p-0 font-sans"
            >
              ← back
            </button>
          </div>
        ) : (
          <>
            <div className="text-sm text-foreground mb-6 space-y-3">
              <p>Enter your quote using this format:</p>
              <pre className="font-sans whitespace-pre-wrap text-muted-foreground">
{`CharacterName: dialogue line
CharacterName: dialogue line`}
              </pre>
              <p>
                You can use generic names like person a, Person A, person A, Person a –
                they will all be recognized as placeholders and can be replaced later with
                custom names.
              </p>
              <p>You can also include character names in narrative text – for example:</p>
              <pre className="font-sans whitespace-pre-wrap text-muted-foreground">
{`The demon Person A summoned, standing amidst the destroyed kitchen: How?!
Person A, flipping through a cookbook: I don't know!!`}
              </pre>
              <p className="text-muted-foreground text-xs">
                (Character names will be automatically detected from both dialogue labels
                and narrative mentions.)
              </p>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full border border-foreground bg-background text-foreground p-4 text-sm font-sans resize-vertical min-h-[250px] mb-6 placeholder:text-muted-foreground"
              rows={10}
              placeholder={"Person A: I can't believe you did that.\nPerson B: In my defense, I was left unsupervised."}
              required
            />

            <div className="flex items-center gap-6">
              <button
                onClick={handleSubmit}
                disabled={!text.trim()}
                className="border border-foreground bg-background text-foreground px-4 py-1.5 text-sm cursor-pointer hover:bg-foreground hover:text-background transition-colors font-sans disabled:opacity-40 disabled:cursor-not-allowed"
              >
                submit
              </button>
              <button
                onClick={() => navigate("/")}
                className="text-foreground text-sm hover:underline bg-background border-none cursor-pointer p-0 font-sans"
              >
                ← back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Submit;
