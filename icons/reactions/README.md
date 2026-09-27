# Reacciones de la pantalla de Peso

Todo lo de esta carpeta es opcional — si no metes nada, la app funciona
igual, solo con emoji + texto por defecto. Nada de esto lo genera Claude
por ti (evitamos usar imágenes con derechos de autor de terceros); esto es
para que metas tus propias imágenes y frases.

## Imágenes (hasta 8 por categoría)

Nombra los archivos así, en esta misma carpeta:

```
up-1.gif      up-2.png      up-3.jpg     ... hasta up-8
down-1.gif    down-2.png    ...          ... hasta down-8
equal-1.gif   equal-2.png   ...          ... hasta equal-8
```

- `up` = cuando subes de peso respecto al registro anterior
- `down` = cuando bajas
- `equal` = cuando te quedas igual

No hace falta rellenar los 8, con uno ya funciona. Cada vez que entras en
Peso se elige una al azar entre las que existan de esa categoría.

## Frases (opcional, una por categoría)

Crea un archivo de texto por categoría con una frase por línea (salto de
línea = una frase nueva):

```
up-phrases.txt
down-phrases.txt
equal-phrases.txt
```

Ejemplo de contenido de `down-phrases.txt`:

```
¡Vas que te matas!
Eso es, sigue así
El sofá te vio bajar de peso, tenías que decírselo
```

Se elige una línea al azar y aparece debajo del emoji/texto.

## Después de añadir archivos

Solo hace falta hacer commit y push como siempre (o pedírselo a Claude) —
la app los detecta sola, sin tocar nada de código.
