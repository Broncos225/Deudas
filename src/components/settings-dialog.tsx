
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CategoryManager } from '@/components/category-manager';
import { useAppData } from '@/contexts/app-data-context';
import { Moon, Sun, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';


const themes = [
  { name: 'Azul', value: 'light-theme-blue', darkValue: 'dark-theme-blue', color: 'hsl(207 88% 54%)' },
  { name: 'Verde', value: 'light-theme-green', darkValue: 'dark-theme-green', color: 'hsl(142 76% 36%)' },
  { name: 'Naranja', value: 'light-theme-orange', darkValue: 'dark-theme-orange', color: 'hsl(25 95% 53%)' },
  { name: 'Rosa', value: 'light-theme-rose', darkValue: 'dark-theme-rose', color: 'hsl(346 89% 45%)' },
  { name: 'Violeta', value: 'light-theme-violet', darkValue: 'dark-theme-violet', color: 'hsl(258 84% 59%)' },
  { name: 'Cian', value: 'light-theme-cyan', darkValue: 'dark-theme-cyan', color: 'hsl(182 90% 45%)' },
  { name: 'Ámbar', value: 'light-theme-amber', darkValue: 'dark-theme-amber', color: 'hsl(45 100% 50%)' },
  { name: 'Gris', value: 'light-theme-gray', darkValue: 'dark-theme-gray', color: 'hsl(240 6% 40%)' },
];

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { categories, isLoading } = useAppData();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [colorTheme, setColorTheme] = useState('light-theme-blue');
  
  useEffect(() => {
    // Limpia el localStorage corrupto una sola vez
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme && storedTheme.includes(' ')) {
      localStorage.setItem('theme', 'light');
    }
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if(isMounted) {
      const storedColor = localStorage.getItem('color-theme') || 'light-theme-blue';
      setColorTheme(storedColor);
    }
  }, [isMounted]);

  useEffect(() => {
    if (isMounted) {
      const allThemeClasses = themes.flatMap(t => [t.value, t.darkValue]);
      document.documentElement.classList.remove(...allThemeClasses);
      
      const themeToApply = themes.find(t => t.value === colorTheme);
      if (themeToApply) {
        if (resolvedTheme === 'dark') {
          document.documentElement.classList.add(themeToApply.darkValue);
        } else {
          document.documentElement.classList.add(themeToApply.value);
        }
      }
    }
  }, [colorTheme, resolvedTheme, isMounted]);

  const handleModeChange = (mode: 'light' | 'dark') => {
    setTheme(mode);
  };

  const handleColorChange = (newColorTheme: string) => {
    setColorTheme(newColorTheme);
    localStorage.setItem('color-theme', newColorTheme);
  };

  const renderThemeButtons = () => {
    if (!isMounted) {
      return (
        <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
        </div>
      )
    }

    return (
        <div className="grid grid-cols-2 gap-2">
            <Button
              variant={resolvedTheme === 'light' ? 'default' : 'outline'}
              onClick={() => handleModeChange('light')}
            >
              <Sun className="mr-2 h-4 w-4" />
              Claro
            </Button>
            <Button
              variant={resolvedTheme === 'dark' ? 'default' : 'outline'}
              onClick={() => handleModeChange('dark')}
            >
              <Moon className="mr-2 h-4 w-4" />
              Oscuro
            </Button>
        </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl grid-rows-[auto,1fr] max-h-[90vh]">
            <DialogHeader>
                <DialogTitle>Configuración</DialogTitle>
                <DialogDescription>
                    Personaliza la apariencia y gestiona las categorías de la aplicación.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-full pr-6">
                <div className="space-y-6 py-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Apariencia</CardTitle>
                            <CardDescription>
                            Personaliza la apariencia de la aplicación.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                            <h3 className="text-sm font-medium">Modo</h3>
                            {renderThemeButtons()}
                            </div>
                            <div className="space-y-2">
                            <h3 className="text-sm font-medium">Tema de Color</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {themes.map((t) => (
                                <button
                                    key={t.value}
                                    onClick={() => handleColorChange(t.value)}
                                    className={cn(
                                    'rounded-md border-2 p-1 transition-all',
                                    colorTheme === t.value
                                        ? 'border-primary ring-2 ring-ring'
                                        : 'border-transparent'
                                    )}
                                >
                                    <div
                                    className="p-2 rounded-sm"
                                    style={{ backgroundColor: t.color }}
                                    >
                                    <div className="w-full aspect-video rounded-sm bg-background/50 flex items-center justify-center">
                                        {colorTheme === t.value && (
                                        <Check className="h-6 w-6 text-primary-foreground" />
                                        )}
                                    </div>
                                    </div>
                                    <p className="text-sm font-medium mt-1">{t.name}</p>
                                </button>
                                ))}
                            </div>
                            </div>
                        </CardContent>
                    </Card>

                    <CategoryManager categories={categories || []} isLoading={isLoading} />
                </div>
            </ScrollArea>
        </DialogContent>
    </Dialog>
  );
}
