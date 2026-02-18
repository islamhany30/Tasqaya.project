import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateSomething1771413886542 implements MigrationInterface {
    name = 'UpdateSomething1771413886542'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`ConfirmationTokens\` (\`TokenID\` int NOT NULL AUTO_INCREMENT, \`WorkerID\` int NOT NULL, \`TaskID\` int NOT NULL, \`Token\` varchar(100) NOT NULL, \`ExpiresAt\` datetime NOT NULL, \`IsUsed\` bit NOT NULL DEFAULT 0, \`CreatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_acbec101c7996d90901898ba00\` (\`Token\`), PRIMARY KEY (\`TokenID\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`ConfirmationTokens\` ADD CONSTRAINT \`FK_118f2bca8b79a52048bf6381682\` FOREIGN KEY (\`WorkerID\`) REFERENCES \`workers\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`ConfirmationTokens\` ADD CONSTRAINT \`FK_0f1b4273de365a1a309a498fa47\` FOREIGN KEY (\`TaskID\`) REFERENCES \`tasks\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ConfirmationTokens\` DROP FOREIGN KEY \`FK_0f1b4273de365a1a309a498fa47\``);
        await queryRunner.query(`ALTER TABLE \`ConfirmationTokens\` DROP FOREIGN KEY \`FK_118f2bca8b79a52048bf6381682\``);
        await queryRunner.query(`DROP INDEX \`IDX_acbec101c7996d90901898ba00\` ON \`ConfirmationTokens\``);
        await queryRunner.query(`DROP TABLE \`ConfirmationTokens\``);
    }

}
