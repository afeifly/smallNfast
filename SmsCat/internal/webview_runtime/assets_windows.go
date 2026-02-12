//go:build windows && embed_webview

package webview_runtime

import (
	"embed"
)

//go:embed WebView2.zip
var webviewAsset embed.FS

func init() {
	localEmbeddedFS = &webviewAsset
}
