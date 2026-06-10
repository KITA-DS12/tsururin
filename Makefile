.PHONY: help dev test smoke deploy sync invalidate ogp promo check-env

# .env があれば読み込む
ifneq (,$(wildcard .env))
include .env
export
endif

# デプロイ対象に含めるファイル/ディレクトリ
DEPLOY_INCLUDES := index.html ogp.png promo.png favicon.svg favicon-192.png apple-touch-icon.png robots.txt sitemap.xml css js

help:
	@echo "tsururin - Available commands:"
	@echo "  make dev         - ローカルサーバー起動 (http://localhost:8000)"
	@echo "  make test        - 単体テスト"
	@echo "  make smoke       - スモークテスト"
	@echo "  make ogp         - OGP 画像生成"
	@echo "  make promo       - プロモ画像生成"
	@echo "  make favicon     - favicon.svg から PNG を再生成"
	@echo "  make deploy      - S3 同期 + CloudFront キャッシュ無効化"
	@echo "  make sync        - S3 同期のみ"
	@echo "  make invalidate  - CloudFront キャッシュ無効化のみ"

dev:
	@echo "→ http://localhost:8000"
	python3 -m http.server 8000

test:
	npm test

smoke:
	npm run smoke

ogp:
	npm run ogp

promo:
	npm run promo

favicon:
	npm run favicon

# .env に必要な環境変数が入っているかチェック
check-env:
	@if [ -z "$(S3_BUCKET)" ]; then \
		echo "ERROR: S3_BUCKET が未設定。.env.example をコピーして .env を作成してください"; exit 1; \
	fi
	@if [ -z "$(CF_DISTRIBUTION_ID)" ]; then \
		echo "ERROR: CF_DISTRIBUTION_ID が未設定。.env を確認してください"; exit 1; \
	fi

# S3 同期: デプロイ対象だけアップロード、バケット上の不要ファイルは削除
sync: check-env
	@echo "→ S3 同期開始: s3://$(S3_BUCKET)"
	aws s3 sync . s3://$(S3_BUCKET) \
		--delete \
		--exclude "*" \
		$(foreach inc,$(DEPLOY_INCLUDES),--include "$(inc)" --include "$(inc)/*") \
		--cache-control "public, max-age=300"
	@# index.html だけは短めキャッシュで上書き（即反映のため）
	aws s3 cp index.html s3://$(S3_BUCKET)/index.html \
		--cache-control "public, max-age=60, must-revalidate" \
		--content-type "text/html; charset=utf-8"
	@echo "→ S3 同期完了"

# CloudFront キャッシュ無効化
invalidate: check-env
	@echo "→ CloudFront キャッシュ無効化: $(CF_DISTRIBUTION_ID)"
	aws cloudfront create-invalidation \
		--distribution-id $(CF_DISTRIBUTION_ID) \
		--paths "/*"
	@echo "→ 無効化リクエスト送信完了（反映まで数分）"

# デプロイ: S3 同期 → CloudFront 無効化
deploy: sync invalidate
	@echo ""
	@echo "✅ デプロイ完了: https://tsururin.mu-k.net"
