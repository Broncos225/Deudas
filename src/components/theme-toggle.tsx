
"use client"

import * as React from "react"
import { Moon, Sun, Check, Palette } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

const themes = [
  { name: 'Azul', theme: 'theme-blue', color: 'hsl(207 88% 54%)' },
  { name: 'Verde', theme: 'theme-green', color: 'hsl(142 76% 36%)' },
  { name: 'Naranja', theme: 'theme-orange', color: 'hsl(25 95% 53%)' },
  { name: 'Rosa', theme: 'theme-rose', color: 'hsl(346 89% 45%)' },
]

export function ThemeToggle() {
  const { setTheme, theme, systemTheme } = useTheme()

  const handleThemeChange = (newTheme: string) => {
    // When changing color theme, we want to preserve the light/dark mode.
    // The theme string can be 'light', 'dark', or 'theme-something'.
    // If we're currently in dark mode (either explicitly or via system), and we select a color theme,
    // we should apply it. Next-themes will handle adding 'dark' class.
    setTheme(newTheme);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Claro</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Oscuro</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="mr-2 h-4 w-4" />
            <span>Temas de Color</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {themes.map((t) => (
                <DropdownMenuItem key={t.theme} onClick={() => handleThemeChange(t.theme)}>
                   <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: t.color }}></div>
                   <span>{t.name}</span>
                   {theme === t.theme && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme("system")}>
          Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
