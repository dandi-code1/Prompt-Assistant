# GitHub Prompt Assistant: User Guide

## 1. Purpose of the Application

The **GitHub Prompt Assistant** is a browser extension designed to streamline your workflow by giving you instant access to a library of text templates, or "prompts," directly within any text field on the web.

Instead of manually copying and pasting frequently used text—like code snippets, email templates, standard replies, or complex instructions—you can store them as simple Markdown files in one or more GitHub repositories. This extension then allows you to search and insert these prompts with a simple command, saving you time and ensuring consistency.

It's built for developers, support teams, writers, and anyone who needs quick access to a personal or shared library of standardized content.

## 2. How to Use the Extension

### Step 1: Configure Your Repositories

Before you can use your prompts, you need to tell the extension where to find them.

1.  Click the extension icon in your browser toolbar to open the main configuration page.
2.  Navigate to the **Configuration** tab.
3.  Click the **"Add Repository"** button.
4.  Fill in the fields for each repository you want to use:
    * **Display Name:** A friendly name for your reference (e.g., "Work Emails," "Personal Code Snippets").
    * **Color:** Choose a color to visually identify prompts from this repository.
    * **GitHub Repository URL:** The full URL to your GitHub repository (e.g., `https://github.com/username/my-prompts`).
    * **Personal Access Token (Optional):** If your repository is private, you must provide a GitHub PAT with `repo` scope. This token is stored securely.

### Step 2: Create Prompts in GitHub

In your configured GitHub repository, simply create new files with a `.md` extension.

* The **filename** (without `.md`) becomes the **prompt name**.
* The **content** of the file is the text that will be inserted.

For example, a file named `daily-report.md` will appear in your menu as the prompt "daily-report".

### Step 3: Using Prompts

There are two ways to access your prompts:

**A) The Prompt Menu**

* In any text field (like a comment box, email composer, or web editor), type `::prompt::`.
* A searchable menu will appear with a list of all your available prompts. Each prompt will have a colored dot indicating which repository it came from.
* Click on a prompt to instantly insert its content.

**B) Dynamic Placeholders (Advanced)**

For prompts that require customization, you can define placeholders directly in the filename.

* **Create a file** with placeholders in curly braces, like: `customer-email-{customer name}-{product}.md`.
* **Write the content** using the same placeholders: `Hi {customer name}, thank you for your interest in {product}.`
* **When you select this prompt** from the menu, a form will automatically appear asking you to fill in the values for "Customer name" and "Product".
* The extension will then replace the placeholders in the content with your input before inserting it.

This powerful feature allows you to create highly dynamic and reusable templates for any purpose.
