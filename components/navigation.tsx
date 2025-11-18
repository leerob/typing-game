"use client";

import Image from "next/image";
import { authClient } from "@/lib/auth-client";
import { useSession } from "@/lib/auth-client";
import { Github } from "lucide-react";

export function Navigation() {
  const { data: sessionData, isPending } = useSession();

  const handleSignIn = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 p-4 flex justify-end items-center z-50">
      <div className={`flex items-center gap-4 transition-opacity ${isPending ? 'opacity-0' : 'opacity-100'}`}>
        <a
          href="https://github.com/aravhawk/typing-game"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:opacity-80 transition-opacity"
          aria-label="View source on GitHub"
        >
          <Github className="w-6 h-6" />
        </a>
        {sessionData?.user ? (
          <a
            href="/profile"
            className="flex items-center hover:opacity-80 transition-opacity"
            title={sessionData.user.name}
            aria-label={`View profile for ${sessionData.user.name}`}
          >
            {sessionData.user.image && (
              <Image
                src={sessionData.user.image}
                alt={sessionData.user.name}
                width={36}
                height={36}
                className="rounded-full"
              />
            )}
          </a>
        ) : (
          <button
            onClick={handleSignIn}
            className="text-base px-4 py-1 border border-border rounded-full hover:bg-secondary/50 transition-colors"
            aria-label="Sign in with Google"
          >
            Sign in
          </button>
        )}
      </div>
    </nav>
  );
}

