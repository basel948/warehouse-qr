"use client";

import { useRef, useState } from "react";

type ErrorMessages = {
  notImage: string;
  tooLarge: string;
  network: string;
  generic: string;
};

export function ImageUploadField({
  value,
  onChange,
  uploadLabel,
  uploadingLabel,
  hintText,
  errorMessages,
}: {
  value: string;
  onChange: (url: string) => void;
  uploadLabel: string;
  uploadingLabel: string;
  hintText: string;
  errorMessages: ErrorMessages;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorText, setErrorText] = useState<string | null>(null);

  function errorMessageForCode(code: string | undefined): string {
    switch (code) {
      case "not_image":
        return errorMessages.notImage;
      case "too_large":
        return errorMessages.tooLarge;
      default:
        return errorMessages.generic;
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setErrorText(null);
    setProgress(0);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setProgress(Math.min(95, Math.round((event.loaded / event.total) * 100)));
      }
    };

    xhr.onload = () => {
      setUploading(false);
      let data: { url?: string; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // fall through to generic error below
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.url) {
        setProgress(100);
        onChange(data.url);
      } else {
        setErrorText(errorMessageForCode(data.error));
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setErrorText(errorMessages.network);
    };

    xhr.send(formData);
  }

  return (
    <div className="flex items-center gap-3">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="w-14 h-14 object-cover rounded border border-stone-200 shrink-0"
        />
      ) : (
        <div
          className="w-14 h-14 shrink-0 rounded border border-dashed border-stone-300 flex items-center justify-center text-stone-300 text-xl"
          aria-hidden
        >
          📦
        </div>
      )}
      <div className="flex flex-col gap-1 min-w-0">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-sm border border-stone-300 rounded px-3 py-1.5 disabled:opacity-50 self-start"
        >
          {uploading ? `${uploadingLabel} ${progress}%` : uploadLabel}
        </button>
        {!uploading && !errorText && <p className="text-xs text-stone-400">{hintText}</p>}
        {uploading && (
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-32 h-1.5 bg-stone-200 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-amber-600 transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {errorText && <p className="text-xs text-red-600">{errorText}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
