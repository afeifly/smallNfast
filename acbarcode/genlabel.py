from PIL import Image, ImageDraw, ImageFont
import os

# ==============================
# Label size
# ==============================
DPI = 600

mm_to_px = lambda mm: int(mm / 25.4 * DPI)

pt_to_px = lambda pt: int(pt / 72 * DPI)

W = mm_to_px(35)
H = mm_to_px(22)

img = Image.new("RGB", (W, H), "white")
draw = ImageDraw.Draw(img)


# ==============================
# Load images
# ==============================
logo = Image.open("t_logo.jpg").convert("RGBA")
bgx = Image.open("b_bgx.png").convert("RGBA")


# Resize logo
logo_w = mm_to_px(9.6)
logo_h = int(logo.height * logo_w / logo.width)

logo = logo.resize(
    (logo_w, logo_h),
    Image.LANCZOS
)

# Place logo top-left
img.alpha_composite(
    logo,
    (mm_to_px(1), mm_to_px(1))
) if img.mode == "RGBA" else img.paste(
    logo,
    (mm_to_px(1), mm_to_px(1)),
    logo
)


# Resize bottom-right image (200% size)
bgx_w = mm_to_px(16)
bgx_h = int(bgx.height * bgx_w / bgx.width)

bgx = bgx.resize(
    (bgx_w, bgx_h),
    Image.LANCZOS
)

# Bottom right position
bgx_x = W - bgx_w - mm_to_px(1)
bgx_y = H - bgx_h - mm_to_px(1)

img.paste(
    bgx,
    (bgx_x, bgx_y),
    bgx
)


# ==============================
# Fonts
# ==============================
def get_font(size):
    fonts = [
        "Arial Bold.ttf",
        "Arial Bold",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "arialbd.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    ]

    for f in fonts:
        try:
            return ImageFont.truetype(f, size)
        except Exception:
            pass

    return ImageFont.load_default()


font_small = get_font(pt_to_px(4))
font_title = get_font(pt_to_px(5))


# ==============================
# Draw label content
# ==============================

# Header URL
url_text = "www.suto-itec.com"
url_bbox = font_title.getbbox(url_text)
url_w = url_bbox[2] - url_bbox[0]
draw.text(
    (W - mm_to_px(2) - url_w, mm_to_px(1.8)),
    url_text,
    font=font_title,
    fill="black"
)

# Horizontal line
draw.line(
    (
        mm_to_px(1),
        mm_to_px(4.2),
        W-mm_to_px(1),
        mm_to_px(4.2)
    ),
    fill="black",
    width=9
)


# Title Model line (uses title font)
draw.text(
    (mm_to_px(1), mm_to_px(4.8)),
    "Model: S403 | Thermal Mass Flow",
    font=font_title,
    fill="black"
)


# Upper 4 Information items (uses basic small font, aligned colons)
upper_items = [
    ("Item No.", ": S695 4035 (Air)"),
    ("Serial No.", ": 3726 0001"),
    ("Range", ": Standard"),
    ("Fieldbus", ": Modbus/RTU+Analog")
]


y = mm_to_px(7.2)
step = mm_to_px(1.7)
colon1_x = mm_to_px(7.2)

for label, val in upper_items:
    draw.text(
        (mm_to_px(1), int(y)),
        label,
        font=font_small,
        fill="black"
    )
    draw.text(
        (colon1_x, int(y)),
        val,
        font=font_small,
        fill="black"
    )
    y += step


# Bottom 2 lines (Split into 2 columns with vertical separator bar)
left_items = [
    ("Power supply", ": 16...30 VDC"),
    ("Max. Pressure", ": 5.0 MPa(g)")
]

right_items = [
    ("Accuracy", ": 1.5%"),
    ("MFD", ": 2027-07")
]

y_bottom = mm_to_px(14.2)

# Left Column
colon_l = mm_to_px(10.6)
for label, val in left_items:
    draw.text(
        (mm_to_px(1), int(y_bottom)),
        label,
        font=font_small,
        fill="black"
    )
    draw.text(
        (colon_l, int(y_bottom)),
        val,
        font=font_small,
        fill="black"
    )
    y_bottom += step

# Vertical Separator Bar (bolder width=5, shorter length 14.3mm to 17.3mm)
draw.line(
    (
        mm_to_px(19.6),
        mm_to_px(14.3),
        mm_to_px(19.6),
        mm_to_px(17.3)
    ),
    fill="black",
    width=5
)

# Right Column
y_r = mm_to_px(14.2)
right_x = mm_to_px(20.4)
colon_r = mm_to_px(26.4)

for label, val in right_items:
    draw.text(
        (right_x, int(y_r)),
        label,
        font=font_small,
        fill="black"
    )
    draw.text(
        (colon_r, int(y_r)),
        val,
        font=font_small,
        fill="black"
    )
    y_r += step


# ==============================
# Save
# ==============================
img.save(
    "label_35x22mm.png",
    dpi=(600,600)
)

print(
    f"Generated {W}x{H}px 35x22mm label"
)
