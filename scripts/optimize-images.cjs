// Script para otimizar imagens PNG sem alterar dimensões
// Mantém qualidade alta enquanto reduz tamanho do arquivo

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const assetsDir = './src/assets';
const backupDir = './src/assets/backup';

// Criar diretório de backup
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

async function optimizeImages() {
    const files = fs.readdirSync(assetsDir).filter(f => f.endsWith('.png'));

    console.log('🔧 Otimizando imagens PNG...\n');

    let totalOriginal = 0;
    let totalOptimized = 0;

    for (const file of files) {
        const inputPath = path.join(assetsDir, file);
        const backupPath = path.join(backupDir, file);
        const tempPath = path.join(assetsDir, `temp_${file}`);

        // Pular se for diretório
        if (fs.statSync(inputPath).isDirectory()) continue;

        const originalSize = fs.statSync(inputPath).size;
        totalOriginal += originalSize;

        // Fazer backup
        fs.copyFileSync(inputPath, backupPath);

        try {
            // Otimizar PNG com compressão lossless
            await sharp(inputPath)
                .png({
                    compressionLevel: 9,  // Máxima compressão
                    quality: 100,         // Máxima qualidade
                    effort: 10,           // Máximo esforço de compressão
                    palette: false        // Manter cores originais
                })
                .toFile(tempPath);

            const optimizedSize = fs.statSync(tempPath).size;
            totalOptimized += optimizedSize;

            // Só substituir se ficou menor
            if (optimizedSize < originalSize) {
                fs.unlinkSync(inputPath);
                fs.renameSync(tempPath, inputPath);

                const savings = ((1 - optimizedSize / originalSize) * 100).toFixed(1);
                console.log(`✅ ${file}: ${(originalSize / 1024).toFixed(1)}KB → ${(optimizedSize / 1024).toFixed(1)}KB (-${savings}%)`);
            } else {
                fs.unlinkSync(tempPath);
                totalOptimized = totalOptimized - optimizedSize + originalSize;
                console.log(`⏭️  ${file}: Já otimizado (${(originalSize / 1024).toFixed(1)}KB)`);
            }
        } catch (err) {
            console.log(`❌ ${file}: Erro - ${err.message}`);
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            totalOptimized += originalSize;
        }
    }

    console.log('\n📊 RESUMO:');
    console.log(`   Original: ${(totalOriginal / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Otimizado: ${(totalOptimized / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Economia: ${((1 - totalOptimized / totalOriginal) * 100).toFixed(1)}%`);
    console.log(`\n💾 Backup salvo em: ${backupDir}`);
}

optimizeImages().catch(console.error);
