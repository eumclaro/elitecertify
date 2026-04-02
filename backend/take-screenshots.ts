import puppeteer from 'puppeteer';
import path from 'path';

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log('Navegando para o login...');
  await page.goto('http://localhost:5173/login');
  await delay(1000);

  // Preencher credenciais e logar
  await page.type('input[type="email"]', 'admin@admin.com'); // guess based on standard seed
  await page.type('input[type="password"]', '123456');
  await page.click('button[type="submit"]');
  
  await delay(2000);

  // Acessar listagem de certificados para printar sidebar
  await page.goto('http://localhost:5173/admin/certificate-templates');
  await delay(2000);
  console.log('Tirando print da sidebar...');
  await page.screenshot({ path: path.join(__dirname, 'admin_sidebar_templates.png') });

  // Ir para Provas para printar o editar e verificar o select
  await page.goto('http://localhost:5173/admin/exams');
  await delay(2000);

  console.log('Abrindo dropdown actions da primeira prova...');
  // Tentar clicar no DropdownMenuTrigger (botão com ícone de MoreVertical)
  const buttons = await page.$$('button');
  // Buscar os que parecem de ação (geralmente nas rows no final)
  // Mas tem os dropdowns
  
  // Como fallback eu posso clicar em Nova Prova ou Injetar script
  await page.evaluate(() => {
    // Acha botões de dropdown de ações pela tabela
    const trs = Array.from(document.querySelectorAll('tbody tr'));
    if (trs.length > 0) {
      const btn = trs[0].querySelector('td:last-child button') as HTMLButtonElement;
      if (btn) btn.click();
    }
  });
  
  await delay(500);

  console.log('Clicando em Editar Prova...');
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[role="menuitem"]')) as HTMLElement[];
    const editBtn = items.find(i => i.textContent?.includes('Editar Prova'));
    if (editBtn) editBtn.click();
  });

  await delay(1000);

  // Selecionar o CHPC
  console.log('Tirando print do modal de edição de prova...');
  // Vamos scrollar o modal para mostrar o campo (embora possa já estar visível se tela for grande)
  await page.screenshot({ path: path.join(__dirname, 'admin_exam_edit_modal.png') });

  await browser.close();
  console.log('Prints finalizados.');
}

run().catch(console.error);
