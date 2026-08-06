Here is a tailored cheat sheet based on your PDF manual for the exact EZPL commands you need to build standard labels with **Text (including Chinese)**, **Lines**, **Images**, and **Barcodes/QRs**.

---

## 1. Label Formatting Block Structure

In EZPL, all design commands **must** sit inside a label format block between `^L` and `E`.

```text
^Q30,3        ; Set label length 30mm, gap 3mm[cite: 1]
^W50          ; Set label width 50mm[cite: 1]
^H10          ; Set print darkness (0~19)[cite: 1]
^S4           ; Set print speed (1~10 inch/sec)[cite: 1]
^L            ; <<< START Label Formatting Block[cite: 1]

... [Your text, lines, images, barcode commands here] ...

E             ; <<< END Label Formatting Block and print[cite: 1]
~P1           ; Print 1 copy[cite: 1]

```

---

## 2. Text Command (Support ASCII & Chinese)

### Option A: Using Built-in Fonts (`At` Command)

Use `At` to render built-in ASCII fonts or pre-loaded Asian Chinese fonts.

* **Syntax:** `At,x,y,x_mul,y_mul,gap,rotationInverse,data`

* `t`: Font type


* `A` ~ `H`: Built-in ASCII fonts


* `Z1` ~ `Z9`: Built-in / Downloaded Asian Fonts (e.g., Traditional/Simplified Chinese)




* `x`, `y`: Top-left coordinate in **dots** (For 203 DPI: $1\text{ mm} = 8\text{ dots}$; 300 DPI: $1\text{ mm} = 12\text{ dots}$).


* `x_mul`, `y_mul`: Width and height magnification ($1 \sim 8$).


* `gap`: Character spacing in dots.


* `rotationInverse`: Rotation (`0`=$0^\circ$, `1`=$90^\circ$, `2`=$180^\circ$, `3`=$270^\circ$). Add `I` for inverse white-on-black printing (e.g., `0I`).




* **Example (ASCII):**
```text
AC,16,24,1,1,0,0,Product Name: Bolt M4

```


* **Example (Chinese - Built-in/Downloaded Asian Font):**
```text
AZ1,16,60,1,1,0,0,产品名称: 螺丝

```



---

### Option B: Using Downloaded TrueType Fonts (`ATt` Command)

If you want to use custom TrueType Fonts (TTF) downloaded to the printer memory:

* **Syntax:** `ATt,x,y,w,h,g,s,d,m,data`

* `t`: Font ID (`A` ~ `Z`).


* `w`, `h`: Font width and height in dots.


* `s`: Style/Rotation (`0`=$0^\circ$; append `B` for Bold, `I` for Italic, `U` for Underline, e.g., `0B`).


* `d`: `0` for ASCII, `1` or `A`~`Z` for Unicode/GoAPP.





---

## 3. Drawing Lines and Rectangles

### A. Drawing a Line (`La` Command)

Draws horizontal or vertical straight lines.

* **Syntax:** `La,x,y,x1,y1`

* `a`: Overwrite mode (`o` = overwrite black over white, `e` = exclusive OR).


* `x`, `y`: Top-left start coordinate in dots.


* `x1`, `y1`: Bottom-right end coordinate in dots.




* **How to control line width/thickness:**
* **Horizontal Line:** Set `y` and `y1` such that $(y1 - y) = \text{line thickness in dots}$.
* **Vertical Line:** Set `x` and `x1` such that $(x1 - x) = \text{line thickness in dots}$.


* **Example (Horizontal dividing line, 3 dots / ~0.37mm thick):**
```text
Lo,16,100,384,103

```


* **Example (Vertical dividing line, 4 dots / ~0.5mm thick):**
```text
Lo,200,10,204,150

```



---

### B. Drawing a Box / Rectangle (`R` Command)

Draws a rectangle with customizable border thicknesses.

* **Syntax:** `Rx,y,x1,y1,lrw,ubw`

* `x`, `y`: Top-left coordinate.


* `x1`, `y1`: Bottom-right coordinate.


* `lrw`: Left and right border thickness in dots.


* `ubw`: Upper and bottom border thickness in dots.




* **Example (Outer border box around the label):**
```text
R10,10,390,230,2,2

```



---

## 4. Inserting Pictures / Graphics

EZPL provides two main ways to print graphics:

### Method A: Printing a Pre-stored Graphic (`Y` Command) - **Recommended for static Logos**

Upload your logo image (PCX, BMP, PNG) to the printer memory beforehand (e.g., using `~E` command or GoLabel software). Then reference its stored name in your label.

* **Syntax:** `Yx,y,name`

* `x`, `y`: Top-left coordinate.


* `name`: The stored image name in printer memory.




* **Example:**
```text
Y16,16,LOGO

```



---

### Method B: Directly Sending In-line Graphic Data (`Q` / `QA` / `G` Commands)

If your web system generates dynamic images on the fly, you convert the image to binary raster dots and send it directly.

* **Syntax (Pattern Command):** `Qx,y,width,height` followed by raw hex/binary pixel data.


* `width`: Image width in **bytes** ($1\text{ byte} = 8\text{ dots}$).


* `height`: Image height in **dots**.





---

## 5. Barcodes & QR Codes (Bonus Essentials)

### 1D Barcode (`Bt` Command - Code 128)

* **Syntax:** `BQ,x,y,narrow,wide,height,rotation,readable,data`

* `narrow`: Narrow bar width ($1 \sim 10\text{ dots}$).


* `wide`: Wide bar width.


* `height`: Barcode height in dots.


* `readable`: `1` = show human-readable text under barcode; `0` = hide.




* **Example:**
```text
BQ,16,120,2,5,60,0,1,PROD-12345

```



### 2D QR Code (`W` Command)

* **Syntax:** `Wx,y,mode,type,ec,mask,mul,len,rotation<CR>data`

* `ec`: Error correction level (`L`, `M`, `Q`, `H`).


* `mul`: Size multiplier ($1 \sim 40$).


* `len`: Character count of data.




* **Example:**
```text
W280,120,2,2,M,8,4,23,0
https://example.com/item

```



---

## Complete EZPL Code Sample

Combining all your requested elements into a single 50mm x 30mm label script:

```text
^Q30,3
^W50
^H10
^S4
^L
; --- 1. Outer Border Box ---
R10,10,390,230,2,2

; --- 2. Logo Image (Pre-stored in Printer Memory) ---
Y20,20,COMPANY_LOGO

; --- 3. Text Header (Chinese + English) ---
AZ1,120,25,1,1,0,0,品名: 工业螺丝
AC,120,50,1,1,0,0,SN: 2026-0806

; --- 4. Horizontal Line (Width / Thickness = 3 dots) ---
Lo,20,80,380,83

; --- 5. Barcode (Code 128) ---
BQ,20,95,2,5,50,0,1,P-889900

; --- 6. QR Code ---
W260,95,2,2,M,8,4,21,0
https://company.com/p
E
~P1

```