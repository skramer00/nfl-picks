"use client";
import { useState } from "react";

export function ShareImageButton({ imageUrl, fileName, label = "Share image" }: { imageUrl: string; fileName: string; label?: string }) {
  const [status, setStatus] = useState("");
  async function share() {
    setStatus("Creating image…");
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("Image generation failed.");
      const file = new File([await response.blob()], fileName, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Pretzel Quest" }); setStatus("Shared");
      } else {
        const href = URL.createObjectURL(file); const anchor = document.createElement("a");
        anchor.href = href; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(href); setStatus("Downloaded");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") setStatus("");
      else setStatus(error instanceof Error ? error.message : "Unable to create image.");
    }
  }
  return <div><button type="button" onClick={share} className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-400">{label}</button>{status ? <span className="ml-3 text-xs text-gray-400" role="status">{status}</span> : null}</div>;
}
