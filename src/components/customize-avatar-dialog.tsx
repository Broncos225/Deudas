
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { Check, Palette, Paintbrush } from 'lucide-react';
import { Separator } from './ui/separator';

interface CustomizeAvatarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAvatarSave: (dataUrl: string) => void;
  currentAvatar: string | null;
}

const predefinedGradients = [
  { id: 'g1', from: '#84fab0', to: '#8fd3f4' },
  { id: 'g2', from: '#a1c4fd', to: '#c2e9fb' },
  { id: 'g3', from: '#fccb90', to: '#d57eeb' },
  { id: 'g4', from: '#ff9a9e', to: '#fecfef' },
  { id: 'g5', from: '#f6d365', to: '#fda085' },
  { id: 'g6', from: '#d4fc79', to: '#96e6a1' },
];

const emojis = ['😀', '😎', '👨‍💻', '🚀', '⭐', '💡', '💰', '📈', '✅', '🤖', '🧠', '🐶', '🐱', '🦄', '🍕', '🎉', '💻', '💸'];

function generateSvgDataUrl(gradient: { colors: string[] }, emoji: string): string {
  let fill;
  if (gradient.colors.length === 1) {
    fill = `fill="${gradient.colors[0]}"`;
  } else {
    const stops = gradient.colors.map((color, index) => 
        `<stop offset="${(index / (gradient.colors.length - 1)) * 100}%" style="stop-color:${color};stop-opacity:1" />`
    ).join('');

    fill = `
      <defs>
        <linearGradient id="avatarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          ${stops}
        </linearGradient>
      </defs>
      <rect width="256" height="256" fill="url(#avatarGradient)" />
    `;
  }

  const svgContent = `
    <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      ${gradient.colors.length === 1 ? `<rect width="256" height="256" fill="${gradient.colors[0]}" />` : fill}
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="140" font-family="sans-serif">${emoji}</text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgContent)))}`;
}


export function CustomizeAvatarDialog({ open, onOpenChange, onAvatarSave, currentAvatar }: CustomizeAvatarDialogProps) {
  const [selectedPredefined, setSelectedPredefined] = useState<string | null>(predefinedGradients[0].id);
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [customPickerColor, setCustomPickerColor] = useState('#aabbcc');
  
  const [selectedEmoji, setSelectedEmoji] = useState('😀');
  const [customEmoji, setCustomEmoji] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');


  const handleCustomColorClick = (color: string) => {
    setCustomColors(prev => {
        setSelectedPredefined(null);
        if (prev.includes(color)) {
            return prev.filter(c => c !== color);
        }
        if (prev.length < 5) {
            return [...prev, color];
        }
        return prev;
    });
  };

  const handlePredefinedClick = (id: string) => {
    setSelectedPredefined(id);
    setCustomColors([]);
  }

  const getGradientFromState = useCallback((): { colors: string[] } => {
    if (selectedPredefined) {
        const predefined = predefinedGradients.find(g => g.id === selectedPredefined);
        return { colors: predefined ? [predefined.from, predefined.to] : ['#fff', '#000'] };
    }
    if (customColors.length > 0) {
        return { colors: customColors };
    }
    return { colors: ['#e2e8f0', '#94a3b8'] }; // Default if nothing is selected
  }, [selectedPredefined, customColors]);


  useEffect(() => {
    const finalEmoji = selectedEmoji === 'custom' ? (customEmoji || ' ') : selectedEmoji;
    const gradient = getGradientFromState();
    const url = generateSvgDataUrl(gradient, finalEmoji);
    setPreviewUrl(url);
  }, [getGradientFromState, selectedEmoji, customEmoji]);

  const handleSave = () => {
    onAvatarSave(previewUrl);
    onOpenChange(false);
  };
  
  const handleAddCustomColor = () => {
    handleCustomColorClick(customPickerColor);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl grid-rows-[auto,1fr] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Personalizar Avatar</DialogTitle>
          <DialogDescription>
            Crea tu avatar único. Elige un gradiente predefinido o crea el tuyo con hasta 5 colores.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-full">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-8 py-4 pr-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2"><Palette className="h-4 w-4" /> 1. Elige un Estilo de Fondo</h3>
              <p className="text-xs text-muted-foreground mb-3">Selecciona un gradiente predefinido o añade colores para crear el tuyo.</p>
              
              <h4 className="text-xs font-semibold mb-2 mt-4">Predefinidos</h4>
              <div className="grid grid-cols-6 gap-2 p-2">
                {predefinedGradients.map(gradient => (
                  <button
                    key={gradient.id}
                    onClick={() => handlePredefinedClick(gradient.id)}
                    className="relative w-full aspect-square rounded-md overflow-hidden transition-all duration-200 hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    style={{ background: `linear-gradient(45deg, ${gradient.from}, ${gradient.to})` }}
                  >
                    {selectedPredefined === gradient.id && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Check className="h-6 w-6 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <Separator className="my-4" />
              
               <h4 className="text-xs font-semibold mb-2">Crea tu Gradiente</h4>
               <div className="flex items-center gap-2 mt-2">
                  <div className="relative h-10 w-16">
                     <Input 
                        type="color" 
                        value={customPickerColor}
                        onChange={(e) => setCustomPickerColor(e.target.value)}
                        className="absolute inset-0 w-full h-full p-0 border-none cursor-pointer"
                        aria-label="Selector de color"
                     />
                     <div 
                        className="w-full h-full rounded-md border pointer-events-none" 
                        style={{ backgroundColor: customPickerColor }}
                     ></div>
                  </div>
                  <Button onClick={handleAddCustomColor} variant="outline" className="flex-1">
                    <Paintbrush className="mr-2 h-4 w-4" />
                    Añadir Color
                  </Button>
               </div>
                {customColors.length > 0 && (
                    <div className="flex items-center gap-2 mt-3">
                        <p className="text-xs text-muted-foreground mr-2">Tus colores:</p>
                        {customColors.map((color, index) => (
                            <button key={index} onClick={() => handleCustomColorClick(color)} className="w-6 h-6 rounded-full border-2 border-white/50 relative" style={{backgroundColor: color}} aria-label={`Quitar color ${color}`}>
                                <div className="absolute -top-1 -right-1 bg-red-500 rounded-full h-3 w-3 flex items-center justify-center text-white text-[8px]">
                                    &times;
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-medium mb-2">2. Elige un Emoji</h3>
              <ScrollArea className="h-32">
                <div className="grid grid-cols-8 gap-2 pr-4">
                  {emojis.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setSelectedEmoji(emoji)}
                      className={cn(
                        "text-3xl p-2 rounded-md transition-colors aspect-square flex items-center justify-center",
                        selectedEmoji === emoji ? 'bg-accent' : 'hover:bg-muted'
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                      key="custom"
                      onClick={() => setSelectedEmoji('custom')}
                      className={cn(
                        "text-xs p-2 rounded-md transition-colors flex items-center justify-center border-2 aspect-square font-medium",
                        selectedEmoji === 'custom' ? 'bg-accent border-accent-foreground/50' : 'hover:bg-muted border-dashed border-muted-foreground'
                      )}
                    >
                      Otro
                    </button>
                </div>
              </ScrollArea>
              {selectedEmoji === 'custom' && (
                <Input 
                  className="mt-2 text-3xl h-14 text-center"
                  placeholder="Tu emoji aquí"
                  value={customEmoji}
                  onChange={(e) => setCustomEmoji(e.target.value)}
                  maxLength={2}
                />
              )}
            </div>
          </div>

          <div className="space-y-4 flex flex-col items-center md:border-l md:pl-8">
            <h3 className="text-sm font-medium">Vista Previa</h3>
            <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-muted shadow-inner">
              {previewUrl && <img src={previewUrl} alt="Vista previa del avatar" />}
            </div>
          </div>
        </div>
        </ScrollArea>

        <DialogFooter>
          <Button type="button" onClick={handleSave}>Guardar Avatar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
