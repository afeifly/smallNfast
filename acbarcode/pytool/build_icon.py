from PIL import Image, ImageDraw


def make_icon(size):
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    m = size // 8
    body_top = m
    body_bottom = size - 2 * m
    draw.rounded_rectangle(
        [m, body_top, size - m, body_bottom],
        radius=max(2, m),
        fill=(40, 120, 200),
        outline=(255, 255, 255),
        width=max(1, size // 32),
    )
    draw.rectangle(
        [2 * m, body_top + m, size - 2 * m, body_bottom - m],
        fill=(255, 255, 255),
    )
    paper_top = body_top + m
    paper_bottom = paper_top + (size - 2 * m) // 2
    draw.rectangle(
        [2 * m, paper_top, size - 2 * m, paper_top + (paper_bottom - paper_top) // 2],
        fill=(90, 170, 230),
    )
    draw.rounded_rectangle(
        [int(m * 1.2), body_bottom + m // 2, size - int(m * 1.2), body_bottom + m],
        radius=max(1, m // 3),
        fill=(40, 120, 200),
    )
    return image


image = make_icon(256)
image.save(
    "print_bridge.ico",
    sizes=[
        (16, 16),
        (24, 24),
        (32, 32),
        (48, 48),
        (64, 64),
        (128, 128),
        (256, 256),
    ],
)