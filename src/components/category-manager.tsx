
"use client";

import { useState, useMemo } from 'react';
import type { Category } from '@/lib/types';
import * as Icons from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { PopoverClose } from '@radix-ui/react-popover';
import { useFirestore, useUser, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';


const colors = [ "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500", "bg-lime-500", "bg-green-500", "bg-emerald-500", "bg-teal-500", "bg-cyan-500", "bg-sky-500", "bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-purple-500", "bg-fuchsia-500", "bg-pink-500", "bg-rose-500", "bg-slate-500"];

const CategoryForm = ({ category, onSave }: { category?: Category, onSave: (data: Omit<Category, 'id' | 'userId'>) => void }) => {
    const [name, setName] = useState(category?.name || '');
    const [selectedIcon, setSelectedIcon] = useState(category?.icon || 'Tag');
    const [selectedColor, setSelectedColor] = useState(category?.color || 'bg-slate-500');
    const [iconSearch, setIconSearch] = useState('');
    const { toast } = useToast();

    // Lista segura de iconos comunes
    const safeIconNames = useMemo(() => {
        const commonIcons = [
            'Tag', 'Home', 'ShoppingCart', 'Car', 'Coffee', 'Heart', 
            'Star', 'Book', 'Music', 'Phone', 'Mail', 'Calendar',
            'Camera', 'Gift', 'Briefcase', 'Plane', 'Utensils', 'Laptop',
            'Wallet', 'CreditCard', 'DollarSign', 'ShoppingBag', 'Package',
            'Truck', 'Building', 'Store', 'Pizza', 'Beer', 'Wine'
        ];
        return commonIcons.filter(name => (Icons as any)[name]);
    }, []);

    const filteredIcons = useMemo(() => {
        if (!iconSearch) return safeIconNames;
        return safeIconNames.filter(icon => icon.toLowerCase().includes(iconSearch.toLowerCase()));
    }, [iconSearch, safeIconNames]);

    const handleSave = () => {
        if (!name) {
            toast({ variant: 'destructive', title: "Error", description: "El nombre de la categoría es requerido." });
            return;
        }
        onSave({ name, icon: selectedIcon, color: selectedColor });
    };
    
    const IconComponent = ((Icons as any)[selectedIcon] || Icons.Tag) as React.ElementType;

    return (
        <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                    Nombre
                </Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Color</Label>
                <div className="col-span-3">
                    <div className="flex flex-wrap gap-2">
                        {colors.map(color => (
                            <button
                                key={color}
                                onClick={() => setSelectedColor(color)}
                                className={cn("w-6 h-6 rounded-full border-2 transition-all", selectedColor === color ? 'border-primary ring-2 ring-ring' : 'border-transparent')}
                            >
                                <div className={cn("w-full h-full rounded-full", color)}></div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Icono</Label>
                <div className="col-span-3">
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                                <IconComponent className="mr-2 h-4 w-4" />
                                {selectedIcon}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                            <Input
                                placeholder="Buscar icono..."
                                value={iconSearch}
                                onChange={e => setIconSearch(e.target.value)}
                                className="m-2 w-[calc(100%-1rem)]"
                            />
                            <ScrollArea className="h-48">
                                <div className="grid grid-cols-5 gap-1 p-2">
                                    {filteredIcons.map(iconName => {
                                        const Icon = (Icons as any)[iconName] as React.ElementType;
                                        return (
                                            <PopoverClose key={iconName} asChild>
                                                <Button
                                                    variant={selectedIcon === iconName ? "default" : "ghost"}
                                                    size="icon"
                                                    onClick={() => setSelectedIcon(iconName)}
                                                    title={iconName}
                                                >
                                                    <Icon className="h-4 w-4" />
                                                </Button>
                                            </PopoverClose>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
            <DialogFooter>
                <Button onClick={handleSave}>Guardar</Button>
            </DialogFooter>
        </div>
    );
};


export const CategoryManager = ({ categories, isLoading }: { categories: Category[], isLoading: boolean }) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | undefined>(undefined);
    const { toast } = useToast();

    const handleSaveCategory = (data: Omit<Category, 'id' | 'userId'>) => {
        if (!user || !firestore) return;
        
        if (editingCategory) {
            // Editing
            const categoryRef = doc(firestore, 'users', user.uid, 'categories', editingCategory.id);
            updateDocumentNonBlocking(categoryRef, data);
            toast({ title: "Categoría actualizada", description: `"${data.name}" ha sido guardada.` });
        } else {
            // Creating
            const categoryRef = collection(firestore, 'users', user.uid, 'categories');
            addDocumentNonBlocking(categoryRef, { ...data, userId: user.uid });
            toast({ title: "Categoría creada", description: `Se ha creado la categoría "${data.name}".` });
        }
        setIsDialogOpen(false);
        setEditingCategory(undefined);
    };

    const handleDeleteCategory = (categoryId: string) => {
        if (!user || !firestore) return;
        const categoryRef = doc(firestore, 'users', user.uid, 'categories', categoryId);
        deleteDocumentNonBlocking(categoryRef);
        toast({ title: "Categoría eliminada" });
    }

    return (
        <Card className="mt-4">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Gestionar Categorías</CardTitle>
                    <CardDescription>Crea, edita y elimina tus categorías para organizar deudas.</CardDescription>
                </div>
                 <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { setIsDialogOpen(isOpen); if (!isOpen) setEditingCategory(undefined); }}>
                    <DialogTrigger asChild>
                        <Button>Crear Categoría</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingCategory ? "Editar Categoría" : "Nueva Categoría"}</DialogTitle>
                            <DialogDescription>
                                {editingCategory ? "Modifica los detalles de tu categoría." : "Elige un nombre, color e icono para tu nueva categoría."}
                            </DialogDescription>
                        </DialogHeader>
                        <CategoryForm category={editingCategory} onSave={handleSaveCategory} />
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {categories?.map(category => {
            const IconComponent = (category.icon && (Icons as any)[category.icon]) || Icons.Tag;
            
            return (
                <div key={category.id} className="group relative flex items-center gap-3 rounded-lg border p-3 bg-muted/50">
                    <span className={cn("p-2 rounded-lg text-white", category.color || "bg-slate-500")}>
                        <IconComponent size={20} />
                    </span>
                    <span className="font-medium flex-1 truncate">{category.name}</span>
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingCategory(category); setIsDialogOpen(true); }}>
                            <Icons.Edit size={16} />
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                    <Icons.Trash2 size={16} />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar Categoría?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción no se puede deshacer. Las deudas asociadas a esta categoría no se eliminarán, pero perderán su categoría.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteCategory(category.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            );
        })}
    </div>
    {(!categories || categories.length === 0) && !isLoading && (
        <div className="text-center py-10">
            <p className="text-muted-foreground">No has creado ninguna categoría.</p>
        </div>
    )}
    {isLoading && (
        <div className="text-center py-10">
            <Icons.Loader size={24} className="animate-spin mx-auto text-primary" />
        </div>
    )}
</CardContent>
        </Card>
    );
}
